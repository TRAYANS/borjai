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

export function health(state, key, formatters) {
  const money = formatters.money;
  const percent = formatters.percent;
  const m = metrics(state, key);
  const w = wealth(state);
  const l = liquid(state);
  const profile = state.profile || {};
  const target = Math.max(m.expense * Number(profile.emergency || 0), Math.max(w, 0) * 0.1);
  const allocation = allocations(state);
  const divisor = w || 1;
  const max = allocation.reduce(function(n, a) { return Math.max(n, a.value / divisor); }, 0);
  const invested = group(state, "Inversiones") + group(state, "Criptomonedas") + group(state, "Oro y Metales");
  const goals = state.goals || [];
  const progress = goals.length ? goals.reduce(function(s, g) {
    const targetAmount = Number(g.target || 0);
    if (targetAmount <= 0) return s;
    return s + Math.min(Number(g.current || 0) / targetAmount, 1);
  }, 0) / goals.length : 0;
  const parts = [
    { label: "Ahorro", score: Math.max(0, Math.min(100, m.rate / 0.2 * 100)), note: m.rate >= 0.15 ? "Ritmo saludable" : "Conviene elevar la tasa" },
    { label: "Liquidez", score: Math.max(0, Math.min(100, l / (target || 1) * 100)), note: money(l) + " frente a " + money(target) + " de reserva" },
    { label: "Inversion", score: Math.min(100, invested / divisor / 0.65 * 100), note: percent(w ? invested / divisor : 0) + " del patrimonio invertido" },
    { label: "Diversificacion", score: Math.max(25, Math.min(100, 120 - max * 100)), note: max > 0.45 ? "Hay concentracion relevante" : "Reparto razonable entre grupos" },
    { label: "Gastos", score: m.savings > 0 ? Math.min(100, 75 + m.rate * 70) : 25, note: m.savings > 0 ? "El mes cierra con ahorro" : "El gasto supera a los ingresos" },
    { label: "Deuda", score: debt(state) ? Math.max(15, 100 - debt(state) / divisor * 150) : 100, note: debt(state) ? "Hay deuda registrada" : "No hay deudas registradas" },
    { label: "Objetivos", score: progress * 100, note: Math.round(progress * 100) + "% de avance medio" }
  ];
  return { score: Math.round(parts.reduce(function(s, p) { return s + p.score; }, 0) / parts.length), parts: parts, liquid: l, target: target, metrics: m };
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
