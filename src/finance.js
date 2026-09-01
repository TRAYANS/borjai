export function account(state, id) {
  return (state.accounts || []).find(function(a) { return a.id === id; }) || (state.accounts || [])[0];
}

export function group(state, name) {
  return (state.assets || []).filter(function(a) { return a.group === name; }).reduce(function(sum, a) { return sum + Number(a.value || 0); }, 0);
}

export function liquid(state) {
  return (state.accounts || []).reduce(function(sum, a) { return sum + Number(a.balance || 0); }, 0);
}

export function debt(state) {
  return (state.debts || []).reduce(function(sum, a) { return sum + Number(a.balance || 0); }, 0);
}

export function wealth(state) {
  return liquid(state) + (state.assets || []).reduce(function(sum, a) { return sum + Number(a.value || 0); }, 0) - debt(state);
}

export function monthItems(state, key) {
  return (state.transactions || []).filter(function(t) { return t.date && t.date.slice(0, 7) === key; });
}

export function metrics(state, key) {
  const list = monthItems(state, key);
  const income = list.filter(function(t) { return t.type === "income" || t.type === "dividend"; }).reduce(function(sum, t) { return sum + Number(t.amount || 0); }, 0);
  const expense = list.filter(function(t) { return t.type === "expense" || t.type === "fee"; }).reduce(function(sum, t) { return sum + Math.abs(Number(t.amount || 0)); }, 0);
  const invested = list.filter(function(t) { return t.type === "investment_buy" || t.type === "investment"; }).reduce(function(sum, t) { return sum + Math.abs(Number(t.amount || 0)); }, 0);
  return { income: income, expense: expense, invested: invested, savings: income - expense, rate: income ? (income - expense) / income : 0 };
}

export function allocations(state) {
  const accounts = state.accounts || [];
  const bank = accounts.filter(function(a) { return a.kind === "bank"; }).reduce(function(s, a) { return s + Number(a.balance || 0); }, 0);
  const cash = accounts.filter(function(a) { return a.kind === "cash"; }).reduce(function(s, a) { return s + Number(a.balance || 0); }, 0);
  return [
    { name: "Bancos", value: bank, color: "#f32d3a" },
    { name: "Inversiones", value: group(state, "Inversiones"), color: "#c51c2a" },
    { name: "Criptomonedas", value: group(state, "Criptomonedas"), color: "#812431" },
    { name: "Oro y Metales", value: group(state, "Oro y Metales"), color: "#c76b50" },
    { name: "Efectivo", value: cash, color: "#636a75" },
    { name: "Otros Activos", value: group(state, "Otros Activos"), color: "#989da5" }
  ].filter(function(a) { return a.value > 0; });
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function linearScore(value, bad, good) {
  if (value <= bad) return 0;
  if (value >= good) return 100;
  return (value - bad) / (good - bad) * 100;
}

function inverseScore(value, good, bad) {
  if (value <= good) return 100;
  if (value >= bad) return 0;
  return (bad - value) / (bad - good) * 100;
}

export function health(state, key, formatters) {
  const money = formatters.money;
  const percent = formatters.percent;
  const m = metrics(state, key);
  const w = wealth(state);
  const l = liquid(state);
  const d = debt(state);
  const profile = state.profile || {};
  const emergencyMonths = Math.max(1, Number(profile.emergency || 3));
  const allocation = allocations(state);

  // The score is calculated only from the financial data stored in the app.
  // No fixed health score or artificial positive baseline is used.
  const expenseBase = m.expense;
  const reserveTarget = expenseBase > 0 ? expenseBase * emergencyMonths : 0;
  const liquidityMonths = expenseBase > 0 ? l / expenseBase : 0;
  const debtRatio = w > 0 ? d / w : (d > 0 ? 1 : 0);
  const spendingRatio = m.income > 0 ? m.expense / m.income : (m.expense > 0 ? 1 : 0);
  const invested = group(state, "Inversiones") + group(state, "Criptomonedas") + group(state, "Oro y Metales");
  const investedRatio = w > 0 ? invested / w : 0;
  const maxAllocation = w > 0 ? allocation.reduce(function(n, a) { return Math.max(n, Math.max(0, a.value) / w); }, 0) : 0;
  const cryptoRatio = w > 0 ? group(state, "Criptomonedas") / w : 0;
  const goals = state.goals || [];
  const validGoals = goals.filter(function(g) { return Number(g.target || 0) > 0; });
  const progress = validGoals.length ? validGoals.reduce(function(s, g) {
    return s + clamp(Number(g.current || 0) / Number(g.target || 1), 0, 1);
  }, 0) / validGoals.length : 0;

  const parts = [
    {
      label: "Ahorro",
      score: m.income > 0 ? linearScore(m.rate, 0, 0.20) : 0,
      note: m.income > 0 ? percent(m.rate) + " de tasa de ahorro" : "Faltan ingresos del mes"
    },
    {
      label: "Liquidez",
      score: expenseBase > 0 ? linearScore(liquidityMonths, 0, emergencyMonths) : 0,
      note: expenseBase > 0 ? money(l) + " frente a " + money(reserveTarget) + " de reserva" : "Faltan gastos del mes"
    },
    {
      label: "Inversion",
      score: w > 0 ? linearScore(investedRatio, 0.05, 0.50) : 0,
      note: w > 0 ? percent(investedRatio) + " del patrimonio en activos de inversión" : "Sin patrimonio registrado"
    },
    {
      label: "Diversificacion",
      score: w > 0 ? inverseScore(maxAllocation, 0.30, 0.70) : 0,
      note: w > 0 ? (maxAllocation > 0 ? percent(maxAllocation) + " en la mayor posición" : "Sin posiciones") : "Sin patrimonio registrado"
    },
    {
      label: "Gastos",
      score: m.income > 0 ? inverseScore(spendingRatio, 0.70, 1) : 0,
      note: m.income > 0 ? percent(spendingRatio) + " de los ingresos destinados a gasto" : "Faltan ingresos del mes"
    },
    {
      label: "Deuda",
      score: d <= 0 ? 100 : (w > 0 ? inverseScore(debtRatio, 0.10, 0.50) : 0),
      note: d > 0 ? money(d) + " de deuda registrada" : "No hay deudas registradas"
    },
    {
      label: "Objetivos",
      score: validGoals.length ? progress * 100 : 0,
      note: validGoals.length ? Math.round(progress * 100) + "% de avance medio" : "No hay objetivos con importe"
    }
  ];

  // Penalise excessive concentration in crypto without treating it as an
  // all-or-nothing rule; this keeps the score responsive to the actual mix.
  if (cryptoRatio > 0.15) {
    const cryptoPenalty = clamp((cryptoRatio - 0.15) / 0.35 * 25, 0, 25);
    parts[3].score = clamp(parts[3].score - cryptoPenalty, 0, 100);
    parts[3].note += "; cripto " + percent(cryptoRatio);
  }

  const score = Math.round(parts.reduce(function(s, p) { return s + p.score; }, 0) / parts.length);
  const populated = [m.income > 0, m.expense > 0, w !== 0, d > 0, validGoals.length > 0].filter(Boolean).length;
  const confidence = populated >= 4 ? "alta" : populated >= 2 ? "media" : "baja";

  return {
    score: score,
    parts: parts,
    liquid: l,
    target: reserveTarget,
    liquidityMonths: liquidityMonths,
    debtRatio: debtRatio,
    spendingRatio: spendingRatio,
    investedRatio: investedRatio,
    confidence: confidence,
    metrics: m
  };
}

export function recommendation(state, key, formatters) {
  const money = formatters.money;
  const h = health(state, key, formatters);
  const m = h.metrics;
  const extra = Math.max(0, h.liquid - h.target);
  if (m.savings <= 0) return { decision: "no_invertir", score: 20, reasons: ["Ahorro mensual menor o igual a cero", "Antes de invertir conviene proteger el flujo mensual"], metrics: { savings: m.savings, savingsRate: m.rate, liquidity: h.liquid, reserveTarget: h.target }, title: "Hoy priorizaria ajustar gasto", main: "No invertir hoy", detail: "Ahorro actual " + money(m.savings), text: "Los gastos han superado los ingresos. Antes de aumentar la cartera, protegeria el flujo mensual y revisaria las categorias discrecionales." };
  if (h.liquid < h.target) return { decision: "mantener_liquidez", score: 55, reasons: ["La reserva de emergencia no esta cubierta", "El ahorro deberia reforzar liquidez antes de asumir riesgo"], metrics: { savings: m.savings, savingsRate: m.rate, liquidity: h.liquid, reserveTarget: h.target }, title: "Hoy mantendria liquidez", main: "Mantener efectivo", detail: "Faltan " + money(h.target - h.liquid), text: "Tu reserva aun no cubre " + ((state.profile || {}).emergency || 0) + " meses de gasto. Destinaria el ahorro a reforzarla antes de asumir mas riesgo." };
  const amount = Math.min((state.profile || {}).contribution || 0, Math.max(100, Math.round(m.savings * 0.35 / 10) * 10));
  return { decision: "invertir", score: 78, reasons: ["El mes genera ahorro", "La liquidez cubre la reserva objetivo"], metrics: { savings: m.savings, savingsRate: m.rate, liquidity: h.liquid, reserveTarget: h.target, suggestedAmount: amount }, title: "Hoy mantendria una aportacion diversificada", main: "Aportar " + money(amount), detail: money(extra) + " por encima de reserva", text: "Tu liquidez cubre la reserva y el mes genera ahorro. Consideraria una aportacion gradual a la cartera sin mover el excedente de golpe." };
}
