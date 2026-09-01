function asNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function legacyId(prefix, id) {
  return String(id || prefix + "-missing");
}

export function normalizeState(state, fallbackFactory) {
  const fallback = fallbackFactory ? fallbackFactory() : {};
  const source = state && state.version === 1 ? state : fallback;
  return {
    version: 1,
    profile: Object.assign({}, fallback.profile || {}, source.profile || {}),
    accounts: Array.isArray(source.accounts) ? source.accounts : [],
    assets: Array.isArray(source.assets) ? source.assets : [],
    debts: Array.isArray(source.debts) ? source.debts : [],
    transactions: Array.isArray(source.transactions) ? source.transactions : [],
    goals: Array.isArray(source.goals) ? source.goals : [],
    imports: Array.isArray(source.imports) ? source.imports : [],
    snapshots: Array.isArray(source.snapshots) ? source.snapshots : []
  };
}

export function validateLegacyState(state) {
  const errors = [];
  if (!state || state.version !== 1) errors.push("El estado local no tiene version 1.");
  if (!Array.isArray(state.accounts)) errors.push("Faltan cuentas.");
  if (!Array.isArray(state.transactions)) errors.push("Faltan movimientos.");
  if (!Array.isArray(state.assets)) errors.push("Faltan activos.");
  if (!Array.isArray(state.debts)) errors.push("Faltan deudas.");
  if (!Array.isArray(state.goals)) errors.push("Faltan objetivos.");
  if (state && Array.isArray(state.transactions)) {
    state.transactions.forEach(function(t, index) {
      if (!t.id) errors.push("Movimiento sin id en posicion " + index + ".");
      if (!t.date) errors.push("Movimiento " + (t.id || index) + " sin fecha.");
      if (!Number.isFinite(Number(t.amount))) errors.push("Movimiento " + (t.id || index) + " sin importe valido.");
    });
  }
  return { ok: errors.length === 0, errors: errors };
}

export function stateCounts(state) {
  return {
    accounts: (state.accounts || []).length,
    transactions: (state.transactions || []).length,
    assets: (state.assets || []).length,
    liabilities: (state.debts || []).length,
    goals: (state.goals || []).length,
    imports: (state.imports || []).length,
    wealthSnapshots: (state.snapshots || []).length
  };
}

export function fingerprintTransaction(t) {
  return [t.date, t.accountId || "", t.type || "", t.category || "", String(Number(t.amount || 0)), t.merchant || "", t.description || ""].join("|");
}

export function dedupeTransactions(transactions) {
  const seen = new Set();
  return (transactions || []).filter(function(t) {
    const key = t.legacyId || t.id || fingerprintTransaction(t);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function snapshotDate(snapshot) {
  if (snapshot && snapshot.date) return String(snapshot.date).slice(0, 10);
  if (snapshot && snapshot.month) {
    const raw = String(snapshot.month);
    return raw.length === 7 ? raw + "-01" : raw.slice(0, 10);
  }
  return "";
}

export function toDatabaseRows(state, userId) {
  const categories = new Map();
  (state.transactions || []).forEach(function(t) {
    if (t.category) categories.set(t.category, { name: t.category, type: t.type === "income" ? "income" : t.type === "transfer" ? "transfer" : t.type && t.type.startsWith("investment") ? "investment" : "expense" });
  });

  return {
    accounts: (state.accounts || []).map(function(a) {
      return {
        user_id: userId,
        legacy_id: legacyId("account", a.id),
        name: a.name || "Cuenta",
        type: a.kind || "checking",
        currency: a.currency || "EUR",
        initial_balance: asNumber(a.initialBalance || a.balance),
        current_balance: asNumber(a.balance),
        is_active: a.isActive !== false
      };
    }),
    categories: Array.from(categories.values()).map(function(c) {
      return { user_id: userId, name: c.name, type: c.type, is_system: false };
    }),
    transactions: dedupeTransactions(state.transactions).map(function(t) {
      return {
        user_id: userId,
        legacy_id: legacyId("transaction", t.id),
        legacy_import_id: t.importId || null,
        account_legacy_id: t.accountId || null,
        destination_account_legacy_id: t.destinationAccountId || null,
        type: t.type || (asNumber(t.amount) >= 0 ? "income" : "expense"),
        date: t.date,
        description: t.description || t.merchant || "Movimiento",
        merchant: t.merchant || t.description || "Movimiento",
        amount: asNumber(t.amount),
        category_name: t.category || "Otros",
        subcategory: t.subcategory || null,
        source: t.source || (t.importId ? "csv" : "manual"),
        notes: t.notes || null
      };
    }),
    assets: (state.assets || []).map(function(a) {
      return {
        user_id: userId,
        legacy_id: legacyId("asset", a.id),
        type: a.group === "Criptomonedas" ? "crypto" : a.group === "Oro y Metales" ? "metal" : a.group === "Inversiones" ? "investment" : "other",
        name: a.name || "Activo",
        ticker: a.ticker || null,
        current_value: asNumber(a.value),
        cost_basis: asNumber(a.cost),
        currency: a.currency || "EUR",
        metadata: { group: a.group || "Otros Activos", legacyType: a.type || null }
      };
    }),
    liabilities: (state.debts || []).map(function(d) {
      return { user_id: userId, legacy_id: legacyId("liability", d.id), type: d.type || "other", name: d.name || "Deuda", outstanding_balance: asNumber(d.balance || d.outstandingBalance), interest_rate: d.interestRate || null, monthly_payment: d.monthlyPayment || null, currency: d.currency || "EUR", metadata: d.metadata || {} };
    }),
    investments: (state.assets || []).filter(function(a) { return ["Inversiones", "Criptomonedas", "Oro y Metales"].includes(a.group); }).map(function(a) {
      return { user_id: userId, legacy_id: "investment-" + legacyId("asset", a.id), ticker: a.ticker || null, name: a.name || "Inversion", type: a.type || "other", quantity: a.quantity || null, buy_price: a.buyPrice || null, current_price: a.currentPrice || null, current_value: asNumber(a.value), cost_basis: asNumber(a.cost), currency: a.currency || "EUR", metadata: { assetLegacyId: a.id || null, group: a.group || null } };
    }),
    goals: (state.goals || []).map(function(g) {
      return { user_id: userId, legacy_id: legacyId("goal", g.id), name: g.name || "Objetivo", target_amount: asNumber(g.target), current_amount: asNumber(g.current), target_date: g.date || null, priority: g.priority || "Media", status: g.status || "active" };
    }),
    imports: (state.imports || []).map(function(i) {
      return {
        user_id: userId,
        legacy_id: legacyId("import", i.id),
        source_type: i.sourceType || "csv",
        file_name: i.fileName || "importacion",
        status: i.status || "confirmed",
        raw_metadata: { count: i.count || 0, ids: i.ids || [], generalNotes: i.generalNotes || "" },
        created_at: i.createdAt ? i.createdAt + "T00:00:00Z" : new Date().toISOString()
      };
    }),
    wealth_snapshots: (state.snapshots || []).map(function(s) {
      const date = snapshotDate(s);
      return { user_id: userId, legacy_id: legacyId("snapshot", date), snapshot_date: date || new Date().toISOString().slice(0, 10), assets_total: asNumber(s.value), liabilities_total: 0, net_worth: asNumber(s.value), liquid_total: null, metadata: { month: (s.month || date.slice(0, 7) || null), source: s.source || "app" } };
    })
  };
}

export function fromDatabaseRows(rows, fallbackFactory) {
  const fallback = fallbackFactory ? fallbackFactory() : { profile: {} };
  return {
    version: 1,
    profile: fallback.profile || {},
    accounts: (rows.accounts || []).map(function(a) { return { id: a.legacy_id || a.id, name: a.name, kind: a.type === "cash" ? "cash" : a.type === "broker" ? "broker" : "bank", balance: asNumber(a.current_balance) }; }),
    assets: (rows.assets || []).map(function(a) { const metadata = a.metadata || {}; return { id: a.legacy_id || a.id, name: a.name, ticker: a.ticker || "", group: metadata.group || "Otros Activos", type: metadata.legacyType || a.type, value: asNumber(a.current_value), cost: asNumber(a.cost_basis) }; }),
    debts: (rows.liabilities || []).map(function(d) { return { id: d.legacy_id || d.id, name: d.name, type: d.type, balance: asNumber(d.outstanding_balance), currency: d.currency || "EUR" }; }),
    transactions: dedupeTransactions((rows.transactions || []).map(function(t) { return { id: t.legacy_id || t.id, date: t.date, merchant: t.merchant || t.description, description: t.description, amount: asNumber(t.amount), type: t.type, category: t.category_name || "Otros", subcategory: t.subcategory || "", accountId: t.account_legacy_id, destinationAccountId: t.destination_account_legacy_id || "", source: t.source || "manual", notes: t.notes || "", importId: t.legacy_import_id || "" }; })),
    goals: (rows.goals || []).map(function(g) { return { id: g.legacy_id || g.id, name: g.name, target: asNumber(g.target_amount), current: asNumber(g.current_amount), date: g.target_date, priority: g.priority || "Media", status: g.status || "active" }; }),
    imports: (rows.imports || []).map(function(i) { const meta = i.raw_metadata || {}; return { id: i.legacy_id || i.id, fileName: i.file_name, createdAt: String(i.created_at || "").slice(0, 10), count: meta.count || 0, ids: meta.ids || [], status: i.status, generalNotes: meta.generalNotes || "" }; }),
    snapshots: (rows.wealth_snapshots || []).map(function(s) { const date = String(s.snapshot_date || "").slice(0, 10); return { date: date, month: (s.metadata && s.metadata.month) ? s.metadata.month : date.slice(0, 7), value: asNumber(s.net_worth) }; }).filter(function(s){ return s.date; })
  };
}
