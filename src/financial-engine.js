const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const ym = (v) => String(v || "").slice(0, 7);
const monthKey = (d = new Date()) => d.toISOString().slice(0, 7);
const abs = (v) => Math.abs(num(v));

export function classifyTransactions(transactions = []) {
  return {
    expenses: transactions.filter(t => ["expense", "fee"].includes(t.type)),
    income: transactions.filter(t => ["income", "dividend"].includes(t.type)),
    transfers: transactions.filter(t => ["transfer", "internal_transfer"].includes(t.type))
  };
}

export function monthlyTotals(transactions = [], month = monthKey()) {
  const groups = classifyTransactions(transactions);
  const expenses = groups.expenses.filter(t => ym(t.date) === month).reduce((s,t) => s + abs(t.amount), 0);
  const income = groups.income.filter(t => ym(t.date) === month).reduce((s,t) => s + abs(t.amount), 0);
  return { expenses, income, net: income - expenses };
}

export function balances(data = {}) {
  const accounts = data.accounts || [];
  const assets = data.assets || [];
  const liabilities = data.liabilities || data.debts || [];
  const liquid = accounts.reduce((s,a) => s + num(a.current_balance), 0);
  const investedAssets = assets.reduce((s,a) => s + num(a.current_value), 0);
  const debt = liabilities.reduce((s,l) => s + num(l.outstanding_balance ?? l.current_balance), 0);
  return { liquid, investedAssets, debt, netWorth: liquid + investedAssets - debt };
}

export function historicalMonthlyExpenses(transactions = [], months = 3) {
  const result = [];
  const d = new Date(); d.setDate(1);
  for (let i = 0; i < months; i += 1) {
    const key = monthKey(d);
    result.push({ month: key, ...monthlyTotals(transactions, key) });
    d.setMonth(d.getMonth() - 1);
  }
  return result;
}

export function recurringPayments(transactions = []) {
  const expenses = classifyTransactions(transactions).expenses;
  const groups = new Map();
  for (const t of expenses) {
    const name = String(t.merchant || t.description || "Movimiento").trim().toLowerCase();
    const amount = Math.round(abs(t.amount) * 100) / 100;
    if (!name || !amount) continue;
    const key = name;
    const list = groups.get(key) || [];
    list.push({ date: String(t.date || ""), amount, original: t });
    groups.set(key, list);
  }
  return [...groups.values()].map(list => {
    list.sort((a,b) => new Date(a.date) - new Date(b.date));
    if (list.length < 2) return null;
    const gaps = [];
    for (let i = 1; i < list.length; i += 1) gaps.push((new Date(list[i].date) - new Date(list[i-1].date)) / 86400000);
    const avgGap = gaps.reduce((s,v) => s + v, 0) / gaps.length;
    const avgAmount = list.reduce((s,v) => s + v.amount, 0) / list.length;
    if (avgGap < 20 || avgGap > 40) return null;
    const last = new Date(list.at(-1).date);
    const next = new Date(last.getTime() + avgGap * 86400000);
    return { merchant: list.at(-1).original.merchant || list.at(-1).original.description || "Movimiento", category: list.at(-1).original.category_name || "Otros", amount: avgAmount, avgGap, next, occurrences: list.length };
  }).filter(Boolean).sort((a,b) => b.amount - a.amount);
}

export function anomalies(transactions = [], month = monthKey()) {
  const expenses = classifyTransactions(transactions).expenses;
  const groups = new Map();
  for (const t of expenses) {
    const key = String(t.category_name || "Otros").toLowerCase();
    const arr = groups.get(key) || [];
    arr.push({ date: t.date, amount: abs(t.amount), merchant: t.merchant || t.description || "Movimiento", category: t.category_name || "Otros" });
    groups.set(key, arr);
  }
  const out = [];
  groups.forEach(arr => {
    const hist = arr.filter(x => ym(x.date) !== month).map(x => x.amount);
    if (hist.length < 3) return;
    const avg = hist.reduce((s,v) => s + v, 0) / hist.length;
    arr.filter(x => ym(x.date) === month && x.amount > Math.max(avg * 2.2, avg + 50)).forEach(x => out.push({ ...x, average: avg }));
  });
  return out.sort((a,b) => b.amount - a.amount).slice(0, 10);
}

export function duplicates(transactions = []) {
  const seen = new Map(); const result = [];
  for (const t of transactions) {
    const key = [ym(t.date), String(t.type || ""), Math.round(num(t.amount) * 100), String(t.merchant || t.description || "").trim().toLowerCase()].join("|");
    const previous = seen.get(key);
    if (previous) result.push({ first: previous, duplicate: t });
    else seen.set(key, t);
  }
  return result;
}

export function healthScore(data = {}, month = monthKey()) {
  const totals = monthlyTotals(data.transactions || [], month);
  const b = balances(data);
  const history = historicalMonthlyExpenses(data.transactions || [], 3).slice(1);
  const avgExpense = history.length ? history.reduce((s,x) => s + x.expenses, 0) / history.length : totals.expenses;
  const savingsRate = totals.income > 0 ? Math.max(0, totals.net / totals.income) : 0;
  const monthsLiquidity = avgExpense > 0 ? b.liquid / avgExpense : 0;
  const debtRatio = b.netWorth > 0 ? b.debt / b.netWorth : 0;
  if (!(data.transactions || []).length && !b.liquid && !b.investedAssets && !b.debt) return { score: 0, savingsRate, monthsLiquidity, debtRatio, label: "Sin datos" };
  let score = 50;
  score += Math.min(25, savingsRate * 100);
  score += Math.min(15, monthsLiquidity * 4);
  score -= Math.min(20, debtRatio * 30);
  return { score: Math.max(0, Math.min(100, Math.round(score))), savingsRate, monthsLiquidity, debtRatio, label: "Calculada con datos reales" };
}

export function affordability(data = {}, amount = 0) {
  const b = balances(data);
  const recurring = recurringPayments(data.transactions || []).reduce((s,r) => s + r.amount, 0);
  const available = Math.max(0, b.liquid - recurring);
  const purchase = Math.max(0, num(amount));
  const after = available - purchase;
  const monthly = monthlyTotals(data.transactions || []).expenses;
  const threshold = Math.max(0, monthly * 1.5);
  return { available, after, affordable: after >= threshold, caution: after >= 0 && after < threshold };
}

export const financialEngine = { classifyTransactions, monthlyTotals, balances, historicalMonthlyExpenses, recurringPayments, anomalies, duplicates, healthScore, affordability };
