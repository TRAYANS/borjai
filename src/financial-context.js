import { allocations, debt, group, health, metrics, wealth } from "./finance.js";

export function buildFinancialContext(state, key, formatters) {
  const h = health(state, key, formatters);
  const m = metrics(state, key);
  const netWorth = wealth(state);
  return {
    currency: "EUR",
    period: key,
    patrimonio: {
      neto: Math.round(netWorth),
      liquidez: Math.round(h.liquid),
      reservaObjetivo: Math.round(h.target),
      deuda: Math.round(debt(state)),
      distribucion: allocations(state).map(function(a) {
        return { activo: a.name, valor: Math.round(a.value), porcentaje: netWorth ? Math.round(a.value / netWorth * 1000) / 10 : 0 };
      })
    },
    ingresos: Math.round(m.income),
    gastos: Math.round(m.expense),
    ahorro: Math.round(m.savings),
    tasaAhorro: Math.round(m.rate * 1000) / 10,
    categoriasGasto: expenseCategories(state, key),
    deudas: (state.debts || []).map(function(d) { return { nombre: d.name, tipo: d.type || "other", saldo: Math.round(d.balance || 0) }; }),
    inversiones: {
      total: Math.round(group(state, "Inversiones") + group(state, "Criptomonedas") + group(state, "Oro y Metales")),
      posiciones: (state.assets || []).filter(function(a) { return ["Inversiones", "Criptomonedas", "Oro y Metales"].includes(a.group); }).map(function(a) {
        return { ticker: a.ticker || "", nombre: a.name, tipo: a.type, valor: Math.round(a.value || 0), coste: Math.round(a.cost || 0), beneficioPerdida: Math.round((a.value || 0) - (a.cost || 0)) };
      })
    },
    objetivos: (state.goals || []).map(function(g) { return { nombre: g.name, actual: Math.round(g.current || 0), objetivo: Math.round(g.target || 0), fecha: g.date, prioridad: g.priority }; }),
    saludFinanciera: {
      puntuacion: h.score,
      factores: h.parts.map(function(p) { return { nombre: p.label, puntuacion: Math.round(p.score), explicacion: p.note }; })
    }
  };
}

function expenseCategories(state, key) {
  const map = {};
  (state.transactions || []).filter(function(t) {
    return t.date && t.date.slice(0, 7) === key && (t.type === "expense" || t.type === "fee");
  }).forEach(function(t) {
    map[t.category || "Otros"] = (map[t.category || "Otros"] || 0) + Math.abs(Number(t.amount || 0));
  });
  const total = Object.keys(map).reduce(function(sum, name) { return sum + map[name]; }, 0);
  return Object.keys(map).map(function(name) {
    return { categoria: name, valor: Math.round(map[name]), porcentaje: total ? Math.round(map[name] / total * 1000) / 10 : 0 };
  }).sort(function(a, b) { return b.valor - a.valor; });
}
