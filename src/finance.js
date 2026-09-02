import { financialEngine } from "./financial-engine.js";

export function account(state, id) {
  return (state.accounts || []).find(function(a) { return a.id === id; }) || (state.accounts || [])[0];
}

export function group(state, name) {
  return (state.assets || []).filter(function(a) {
    return String(a.group || "").toLowerCase() === String(name || "").toLowerCase();
  }).reduce(function(sum, a) { return sum + Number(a.current_value ?? a.value ?? 0); }, 0);
}

export function liquid(state) {
  return (state.accounts || []).reduce(function(sum, a) {
    return sum + Number(a.current_balance ?? a.balance ?? 0);
  }, 0);
}

export function debt(state) {
  return (state.liabilities || state.debts || []).reduce(function(sum, a) {
    return sum + Number(a.outstanding_balance ?? a.current_balance ?? a.balance ?? 0);
  }, 0);
}

export function wealth(state) {
  return financialEngine.balances(state).netWorth;
}

export function monthItems(state, key) {
  return (state.transactions || []).filter(function(t) { return t.date && t.date.slice(0, 7) === key; });
}

export function metrics(state, key) {
  const list = monthItems(state, key);
  const income = list.filter(function(t) { return t.type === "income" || t.type === "dividend"; }).reduce(function(sum, t) { return sum + Number(t.amount || 0); }, 0);
  const expense = list.filter(function(t) { return t.type === "expense" || t.type === "fee"; }).reduce(function(sum, t) { return sum + Math.abs(Number(t.amount || 0)); }, 0);
  const invested = list.filter(function(t) { return t.type === "investment_buy" || t.type === "investment"; }).reduce(function(sum, t) { return sum + Math.abs(Number(t.amount || 0)); }, 0);
  return { income, expense, invested, savings: income - expense, rate: income ? (income - expense) / income : 0 };
}

export function allocations(state) {
  const accounts = state.accounts || [];
  const bank = accounts.filter(function(a) { return a.kind === "bank"; }).reduce(function(s, a) { return s + Number(a.current_balance ?? a.balance ?? 0); }, 0);
  const cash = accounts.filter(function(a) { return a.kind === "cash"; }).reduce(function(s, a) { return s + Number(a.current_balance ?? a.balance ?? 0); }, 0);
  return [
    { name: "Bancos", value: bank, color: "#f32d3a" },
    { name: "Inversiones", value: group(state, "Inversiones"), color: "#c51c2a" },
    { name: "Criptomonedas", value: group(state, "Criptomonedas"), color: "#812431" },
    { name: "Oro y Metales", value: group(state, "Oro y Metales"), color: "#c76b50" },
    { name: "Efectivo", value: cash, color: "#636a75" },
    { name: "Otros Activos", value: group(state, "Otros Activos"), color: "#989da5" }
  ].filter(function(a) { return a.value > 0; });
}

export function health(state, key, formatters) {
  // Única fuente de verdad: Inicio ya no calcula una salud distinta.
  // BorjaAI 2.0 y el monitor utilizan exactamente el mismo motor.
  const h = financialEngine.healthScore(state, key);
  const money = formatters.money;
  const percent = formatters.percent;
  const parts = h.parts.map(function(part) {
    let note = "";
    if (part.label === "Ahorro") note = h.metrics.income > 0 ? percent(h.savingsRate) + " de tasa de ahorro" : "Faltan ingresos del mes";
    if (part.label === "Liquidez") note = h.metrics.expense > 0 ? money(h.liquid ?? financialEngine.balances(state).liquid) + " frente a " + money(h.target) + " de reserva" : "Faltan gastos del mes";
    if (part.label === "Inversion") note = h.metrics.income || h.investedRatio ? percent(h.investedRatio) + " del patrimonio en activos de inversión" : "Sin patrimonio registrado";
    if (part.label === "Diversificacion") note = "Distribución de las posiciones registradas";
    if (part.label === "Gastos") note = h.metrics.income > 0 ? percent(h.spendingRatio) + " de los ingresos destinados a gasto" : "Faltan ingresos del mes";
    if (part.label === "Deuda") note = financialEngine.balances(state).debt > 0 ? money(financialEngine.balances(state).debt) + " de deuda registrada" : "No hay deudas registradas";
    if (part.label === "Objetivos") note = "Progreso de los objetivos con importe";
    return { label: part.label, score: part.score, note };
  });
  return {
    ...h,
    parts,
    liquid: financialEngine.balances(state).liquid,
    metrics: metrics(state, key)
  };
}

export function recommendation(state, key, formatters) {
  const money = formatters.money;
  const h = health(state, key, formatters);
  const m = h.metrics;
  const extra = Math.max(0, h.liquid - h.target);
  if (h.score === 0 && h.label === "Sin datos") {
    return { decision: "sin_datos", score: 0, reasons: ["Todavía no hay datos económicos", "Importa movimientos o añade patrimonio para empezar el análisis"], metrics: { savings: 0, savingsRate: 0, liquidity: 0, reserveTarget: 0 }, title: "Aún no hay suficiente información", main: "Esperando datos", detail: "La salud financiera no se puede calcular todavía", text: "Cuando Borjai tenga movimientos, cuentas, patrimonio u objetivos con importes podrá calcular tu salud financiera de forma real." };
  }
  if (m.savings <= 0) return { decision: "no_invertir", score: 20, reasons: ["Ahorro mensual menor o igual a cero", "Antes de invertir conviene proteger el flujo mensual"], metrics: { savings: m.savings, savingsRate: m.rate, liquidity: h.liquid, reserveTarget: h.target }, title: "Hoy priorizaria ajustar gasto", main: "No invertir hoy", detail: "Ahorro actual " + money(m.savings), text: "Los gastos han superado los ingresos. Antes de aumentar la cartera, protegeria el flujo mensual y revisaria las categorias discrecionales." };
  if (h.liquid < h.target) return { decision: "mantener_liquidez", score: 55, reasons: ["La reserva de emergencia no esta cubierta", "El ahorro deberia reforzar liquidez antes de asumir riesgo"], metrics: { savings: m.savings, savingsRate: m.rate, liquidity: h.liquid, reserveTarget: h.target }, title: "Hoy mantendria liquidez", main: "Mantener efectivo", detail: "Faltan " + money(h.target - h.liquid), text: "Tu reserva aun no cubre " + ((state.profile || {}).emergency || 0) + " meses de gasto. Destinaria el ahorro a reforzarla antes de asumir mas riesgo." };
  const amount = Math.min((state.profile || {}).contribution || 0, Math.max(100, Math.round(m.savings * 0.35 / 10) * 10));
  return { decision: "invertir", score: 78, reasons: ["El mes genera ahorro", "La liquidez cubre la reserva objetivo"], metrics: { savings: m.savings, savingsRate: m.rate, liquidity: h.liquid, reserveTarget: h.target, suggestedAmount: amount }, title: "Hoy mantendria una aportacion diversificada", main: "Aportar " + money(amount), detail: money(extra) + " por encima de reserva", text: "Tu liquidez cubre la reserva y el mes genera ahorro. Consideraria una aportacion gradual a la cartera sin mover el excedente de golpe." };
}
