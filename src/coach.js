function clean(n) {
  return String(n || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function buildLocalCoachAnswer(question, context, formatters) {
  const n = clean(question);
  const money = formatters.money;
  const m = context.metrics;
  const h = context.health;
  const top = context.topExpense;
  const r = context.recommendation;

  if (n.includes("inviert") || n.includes("cartera") || n.includes("donde")) {
    return r.main + ". " + r.text + " Tu cartera invertida es " + money(context.invested) + ".";
  }
  if (n.includes("gast") || n.includes("recort")) {
    return top ? "Este mes has gastado " + money(m.expense) + ". La partida con mas impacto es " + top.name + " (" + money(top.value) + "). Un recorte del 10% liberaria " + money(top.value * 0.1) + ". Tus " + money(m.invested) + " de aportaciones no son gasto." : "Aun no hay suficientes gastos para detectar un patron.";
  }
  if (n.includes("patrimonio") || n.includes("como voy")) {
    return "Tu patrimonio actual es " + money(context.wealth) + ". El ahorro del mes es " + money(m.savings) + " y la salud financiera es " + h.score + "/100.";
  }
  if (n.includes("liquidez") || n.includes("efectivo")) {
    return "Tienes " + money(h.liquid) + " en cuentas y efectivo. Con gasto mensual de " + money(m.expense) + ", el objetivo de reserva es " + money(h.target) + ".";
  }
  if (n.includes("objetiv")) {
    const g = context.goals.slice().sort(function(a, b) { return b.current / b.target - a.current / a.target; })[0];
    return g ? "Tu objetivo mas avanzado es " + g.name + ": " + Math.round(g.current / g.target * 100) + "%. Faltan " + money(g.target - g.current) + "." : "Crea un objetivo para calcular el ritmo necesario.";
  }
  if (n.includes("riesgo") || n.includes("alert")) {
    return context.alerts.filter(function(a) { return a.level !== "good"; }).map(function(a) { return a.title + ": " + a.text; }).join(" ") || "No detecto alertas relevantes.";
  }
  return "Tu patrimonio es " + money(context.wealth) + ", ahorras " + money(m.savings) + " este mes y tu salud financiera es " + h.score + "/100. Preguntame por gasto, liquidez, cartera, objetivos o patrimonio.";
}
