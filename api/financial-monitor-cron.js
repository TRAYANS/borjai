import { createClient } from "@supabase/supabase-js";
import { financialEngine } from "../src/financial-engine.js";

const MONITOR_KEY = "borjai_monitor";
const WEEK = 7 * 86400000;
const money = value => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value || 0)).replace(/\u00a0/g, " ");
const month = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret && req.headers.authorization === `Bearer ${secret}`);
}

function admin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan las credenciales server-side de Supabase.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

function fingerprint(findings) {
  return findings.filter(x => x.level === "critical").map(x => `${x.kind}:${x.title}`).join("|") || findings.filter(x => x.level === "warn").slice(0, 2).map(x => `${x.kind}:${x.title}`).join("|");
}

function analyze(data, profile = {}) {
  const transactions = data.transactions || [];
  const cfg = {
    emergency: Number(profile.emergency || 3),
    minimumLiquidity: Number(profile.minimumLiquidity || 0),
    protectMinimum: profile.protectMinimum !== false,
    savingsTarget: Number(profile.savingsTarget || 0),
    alertSpend: Number(profile.alertSpend || 0),
    alerts: { exceptional: true, category: true, recurring: true, duplicate: true, lowBalance: true, investment: false, goal: true, wealthDrop: true, ...(profile.alertEnabled || {}) }
  };
  const totals = financialEngine.monthlyTotals(transactions, month());
  const balances = financialEngine.balances(data);
  const health = financialEngine.healthScore(data, month());
  const history = financialEngine.historicalMonthlyExpenses(transactions, 4).slice(1);
  const avgExpense = history.length ? history.reduce((s, x) => s + x.expenses, 0) / history.length : totals.expenses;
  const recurring = financialEngine.recurringPayments(transactions);
  const anomalies = financialEngine.anomalies(transactions, month());
  const duplicates = financialEngine.duplicates(transactions);
  const findings = [];
  const liquidityTarget = Math.max(cfg.minimumLiquidity, cfg.emergency * avgExpense);

  if (cfg.alerts.lowBalance && cfg.protectMinimum && cfg.minimumLiquidity > 0 && balances.liquid < cfg.minimumLiquidity) findings.push({ level: "critical", kind: "lowBalance", title: "Liquidez por debajo de tu mínimo", text: `Tienes ${money(balances.liquid)} líquidos y tu mínimo protegido es ${money(cfg.minimumLiquidity)}.`, action: "Priorizaría recuperar liquidez antes de asumir más riesgo." });
  else if (cfg.alerts.lowBalance && liquidityTarget > 0 && balances.liquid < liquidityTarget) findings.push({ level: "warn", kind: "lowBalance", title: "Colchón de seguridad por debajo del objetivo", text: `Tu liquidez es ${money(balances.liquid)} y el colchón objetivo ronda ${money(liquidityTarget)}.`, action: "Priorizaría liquidez antes de aumentar exposición a riesgo." });

  const snapshots = (data.snapshots || []).map(s => ({ date: String(s.date || s.month || "").slice(0, 10), value: Number(s.value ?? s.net_worth ?? 0) })).filter(x => x.date && Number.isFinite(x.value)).sort((a, b) => a.date.localeCompare(b.date));
  if (cfg.alerts.wealthDrop && snapshots.length > 1) {
    const last = snapshots.at(-1), prev = snapshots.at(-2), ratio = Math.abs(prev.value) ? (last.value - prev.value) / Math.abs(prev.value) : 0;
    if (ratio < -0.08) findings.push({ level: "critical", kind: "wealthDrop", title: "Caída relevante del patrimonio", text: `El patrimonio registrado ha caído ${Math.round(Math.abs(ratio) * 100)}% (${money(Math.abs(last.value - prev.value))}) respecto al registro anterior.`, action: "Revisaría primero qué movimiento o inversión explica la caída." });
  }

  if (cfg.alerts.exceptional && cfg.alertSpend > 0) {
    const big = transactions.filter(t => ["expense", "fee"].includes(t.type) && String(t.date || "").slice(0, 7) === month() && Math.abs(Number(t.amount || 0)) >= cfg.alertSpend).sort((a, b) => Math.abs(Number(b.amount || 0)) - Math.abs(Number(a.amount || 0)))[0];
    if (big) findings.push({ level: "warn", kind: "exceptional", title: "Gasto excepcional detectado", text: `${big.merchant || big.description || "Movimiento"} ha supuesto ${money(Math.abs(Number(big.amount || 0)))}.`, action: "Si es puntual, lo trataría como excepcional; si se repite, ajustaría el presupuesto." });
  }

  const byCategory = new Map();
  for (const t of transactions) if (["expense", "fee"].includes(t.type) && String(t.date || "").slice(0, 7) === month()) { const k = t.category_name || t.category || "Otros"; byCategory.set(k, (byCategory.get(k) || 0) + Math.abs(Number(t.amount || 0))); }
  const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
  if (cfg.alerts.category && top && totals.expenses > 0 && top[1] / totals.expenses > .25) findings.push({ level: "warn", kind: "category", title: "Aquí veo margen para recortar", text: `${top[0]} concentra ${Math.round(top[1] / totals.expenses * 100)}% de tus gastos del mes (${money(top[1])}).`, action: `Buscaría un recorte del 10–20% en ${top[0]} antes de tocar gastos esenciales.` });
  if (cfg.alerts.category && cfg.savingsTarget > 0 && totals.income - totals.expenses < cfg.savingsTarget) findings.push({ level: "warn", kind: "savingsTarget", title: "El ahorro va por debajo de tu objetivo", text: `El ahorro estimado es ${money(totals.income - totals.expenses)} frente a ${money(cfg.savingsTarget)} objetivo.`, action: "Recortaría primero categorías discrecionales." });
  if (cfg.alerts.recurring && recurring.length) { const r = recurring[0]; findings.push({ level: "info", kind: "recurring", title: "Pago recurrente detectado", text: `${r.merchant}: ${money(r.amount)} aproximadamente cada ${Math.round(r.avgGap)} días.`, action: "Revisaría si sigue siendo necesario; los pagos repetidos son candidatos a recorte." }); }
  if (cfg.alerts.duplicate && duplicates.length) findings.push({ level: "warn", kind: "duplicate", title: "Posible movimiento duplicado", text: `${duplicates.length} coincidencia(s) requieren revisión.`, action: "No lo eliminaría automáticamente; confirma primero el cargo." });
  if (cfg.alerts.category && anomalies.length) { const a = anomalies[0]; findings.push({ level: "warn", kind: "anomaly", title: "Gasto fuera de tu patrón habitual", text: `${a.merchant}: ${money(a.amount)} frente a una media de ${money(a.average)}.`, action: "Si no era extraordinario, lo usaría como señal para ajustar esa categoría." }); }
  if (cfg.alerts.goal && (data.goals || []).some(g => Number(g.target_amount || 0) > Number(g.current_amount || 0) && g.date && new Date(g.date) < new Date(Date.now() + 180 * 86400000))) findings.push({ level: "warn", kind: "goal", title: "Un objetivo puede quedarse corto", text: "Hay una meta próxima a su fecha que todavía no está financiada al 100%.", action: "Separaría una aportación específica antes de asumir más riesgo." });
  findings.sort((a, b) => ({ critical: 0, warn: 1, info: 2, good: 3 }[a.level] - ({ critical: 0, warn: 1, info: 2, good: 3 }[b.level])));
  if (!findings.length) findings.push({ level: "good", kind: "stable", title: "Situación estable", text: "No he encontrado una señal financiera que requiera actuar ahora mismo.", action: "Mantendría el plan y seguiría acumulando datos." });
  return { generatedAt: new Date().toISOString(), date: today(), totals, balances, health, findings, recurring, anomalies, duplicates };
}

async function readState(client, userId) {
  const tables = ["transactions", "accounts", "assets", "liabilities", "investments", "goals", "wealth_snapshots"];
  const read = async table => { const result = await client.from(table).select("*").eq("user_id", userId); if (result.error) throw result.error; return result.data || []; };
  const [transactions, accounts, assets, liabilities, investments, goals, snapshots] = await Promise.all(tables.map(read));
  return { transactions, accounts, assets, liabilities, investments, goals, snapshots };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });
  try {
    const client = admin();
    const ownerId = process.env.BORJAI_OWNER_ID;
    let users = [];
    if (ownerId) {
      const result = await client.auth.admin.getUserById(ownerId);
      if (result.error) throw result.error;
      if (result.data?.user) users = [result.data.user];
    } else {
      const result = await client.auth.admin.listUsers({ perPage: 1000 });
      if (result.error) throw result.error;
      users = result.data?.users || [];
    }

    const results = [];
    for (const user of users) {
      const data = await readState(client, user.id);
      const analysis = analyze(data, user.user_metadata?.borjai_profile || {});
      const previous = user.user_metadata?.[MONITOR_KEY] || {};
      const fp = fingerprint(analysis.findings);
      const changed = Boolean(fp && fp !== (previous.lastServerFingerprint || ""));
      const weeklyDue = !previous.lastServerWeeklyAt || Date.now() - new Date(previous.lastServerWeeklyAt).getTime() >= WEEK;
      const next = {
        ...previous,
        lastServerCheckAt: analysis.generatedAt,
        lastServerFingerprint: fp,
        serverCriticalCount: analysis.findings.filter(x => x.level === "critical").length,
        serverWarningCount: analysis.findings.filter(x => x.level === "warn").length,
        serverFindings: analysis.findings.slice(0, 8),
        serverNewAlert: changed,
        ...(weeklyDue ? { lastServerWeeklyAt: analysis.generatedAt, serverWeeklyFindings: analysis.findings.slice(0, 8), weeklyFindings: analysis.findings.slice(0, 8), lastWeeklyAt: analysis.generatedAt } : {})
      };
      const update = await client.auth.admin.updateUserById(user.id, { user_metadata: { ...(user.user_metadata || {}), [MONITOR_KEY]: next } });
      if (update.error) throw update.error;
      results.push({ critical: next.serverCriticalCount, warnings: next.serverWarningCount, changed, weekly: weeklyDue });
    }
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, checkedAt: new Date().toISOString(), users: results.length, results });
  } catch (error) {
    console.error("Borjai financial monitor cron:", error);
    return res.status(500).json({ ok: false, error: error?.message || "No se pudo completar la revisión." });
  }
}
