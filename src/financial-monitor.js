import { loadRuntimeConfig, hasSupabaseConfig } from "./config.js";
import { createSupabaseClient } from "./db/supabaseClient.js";
import { financialEngine } from "./financial-engine.js";

const MONITOR_KEY = "borjai_monitor";
const WEEK = 7 * 86400000;
let clientPromise;
let userCache;
let busy = false;
let latest = { daily: [], weekly: [], updatedAt: null };

const euro = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const money = v => euro.format(Number(v || 0)).replace(/\u00a0/g, " ");
const esc = v => String(v ?? "").replace(/[&<>\"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;", "'": "&#039;" }[c]));
const today = () => new Date().toISOString().slice(0, 10);
const month = () => today().slice(0, 7);

function injectStyle() {
  if (document.getElementById("financial-monitor-style")) return;
  const style = document.createElement("style");
  style.id = "financial-monitor-style";
  style.textContent = `.fm-toast{position:fixed;right:22px;bottom:22px;z-index:300;width:min(390px,calc(100vw - 28px));background:#111419;border:1px solid #323741;border-radius:16px;padding:15px 16px;box-shadow:0 18px 55px rgba(0,0,0,.42);color:#f5f7fa;cursor:pointer}.fm-toast.critical{border-color:#7d2b34;box-shadow:0 18px 55px rgba(243,45,58,.14)}.fm-toast-head{display:flex;align-items:center;gap:10px;font-size:13px;font-weight:850}.fm-toast-dot{width:9px;height:9px;border-radius:50%;background:#f32d3a;box-shadow:0 0 0 5px rgba(243,45,58,.11)}.fm-toast p{margin:8px 0 0;color:#aab1bc;font-size:12px;line-height:1.45}.fm-toast small{display:block;margin-top:10px;color:#737b88;font-size:10px}.fm-panel{position:fixed;inset:0;z-index:260;background:rgba(5,6,8,.82);backdrop-filter:blur(10px);overflow:auto;padding:30px 20px}.fm-wrap{width:min(980px,100%);margin:0 auto;background:#0d1014;border:1px solid #292e36;border-radius:22px;box-shadow:0 30px 100px rgba(0,0,0,.5);overflow:hidden}.fm-head{display:flex;justify-content:space-between;gap:20px;padding:24px 26px;border-bottom:1px solid #242931}.fm-kicker{font-size:10px;letter-spacing:.16em;color:#f32d3a;font-weight:900;text-transform:uppercase}.fm-head h2{margin:5px 0;font-size:26px;letter-spacing:-.035em}.fm-head p{margin:0;color:#858d99;font-size:12px}.fm-close{border:1px solid #30353e;background:#171a20;color:#dce0e6;border-radius:10px;padding:9px 12px;cursor:pointer}.fm-body{padding:20px 26px 28px}.fm-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px}.fm-card{background:#11151a;border:1px solid #252a32;border-radius:14px;padding:14px}.fm-card strong{display:block;font-size:19px}.fm-card span{display:block;margin-top:4px;color:#7f8793;font-size:11px}.fm-section{margin-top:16px}.fm-section h3{font-size:15px;margin:0 0 9px}.fm-list{display:grid;gap:9px}.fm-item{padding:13px 14px;border:1px solid #252a32;border-radius:13px;background:#101318}.fm-item.critical{border-color:#6c2a32}.fm-item.warn{border-color:#5a4927}.fm-item.good{border-color:#254b38}.fm-item-head{display:flex;align-items:center;justify-content:space-between;gap:10px}.fm-item strong{font-size:13px}.fm-pill{font-size:9px;font-weight:900;letter-spacing:.08em;padding:4px 7px;border-radius:999px;background:#1a1f26;color:#b9c0ca}.fm-item p{margin:6px 0 0;color:#939ba7;font-size:11px;line-height:1.5}.fm-action{color:#e2e6eb!important}.fm-empty{padding:18px;border:1px dashed #303640;border-radius:13px;color:#7f8793;text-align:center;font-size:12px}.fm-foot{padding:13px 26px;border-top:1px solid #242931;color:#666f7b;font-size:10px}@media(max-width:650px){.fm-panel{padding:12px}.fm-head,.fm-body{padding-left:16px;padding-right:16px}.fm-summary{grid-template-columns:1fr}.fm-head h2{font-size:22px}.fm-toast{right:14px;bottom:78px}}`;
  document.head.appendChild(style);
}

async function getClient() {
  if (!clientPromise) clientPromise = loadRuntimeConfig().then(config => {
    if (!hasSupabaseConfig(config)) throw new Error("Supabase no está configurado.");
    return createSupabaseClient(config);
  });
  return clientPromise;
}

async function getUser() {
  if (userCache) return userCache;
  const client = await getClient();
  const result = await client.auth.getUser();
  if (result.error) throw result.error;
  if (!result.data?.user) throw new Error("La sesión ha caducado.");
  const user = result.data.user;
  userCache = { client, user, profile: user.user_metadata?.borjai_profile || {}, monitor: user.user_metadata?.[MONITOR_KEY] || {} };
  return userCache;
}

async function readState() {
  const { client, user } = await getUser();
  const tables = ["transactions", "accounts", "assets", "liabilities", "investments", "goals", "wealth_snapshots"];
  const read = async table => {
    const r = await client.from(table).select("*").eq("user_id", user.id);
    if (r.error) throw r.error;
    return r.data || [];
  };
  const [transactions, accounts, assets, liabilities, investments, goals, snapshots] = await Promise.all(tables.map(read));
  return { transactions, accounts, assets, liabilities, investments, goals, snapshots };
}

function settings(profile) {
  return {
    emergency: Number(profile.emergency || 3),
    minimumLiquidity: Number(profile.minimumLiquidity || 0),
    protectMinimum: profile.protectMinimum !== false,
    savingsTarget: Number(profile.savingsTarget || 0),
    alertSpend: Number(profile.alertSpend || 0),
    alertMonthlySpend: Number(profile.alertMonthlySpend || 0),
    excludedAssets: Array.isArray(profile.excludedAssets) ? profile.excludedAssets : [],
    alerts: { exceptional: true, category: true, recurring: true, duplicate: true, lowBalance: true, investment: false, goal: true, wealthDrop: true, ...(profile.alertEnabled || {}) }
  };
}

function wealthChange(data) {
  const rows = (data.snapshots || []).map(s => ({ date: String(s.date || s.month || "").slice(0, 10), value: Number(s.value ?? s.net_worth ?? 0) })).filter(s => s.date && Number.isFinite(s.value)).sort((a, b) => a.date.localeCompare(b.date));
  if (rows.length < 2) return null;
  const last = rows.at(-1), previous = rows.at(-2), base = Math.abs(previous.value);
  return { change: last.value - previous.value, ratio: base ? (last.value - previous.value) / base : 0 };
}

function categoryCuts(data, total, cfg) {
  const map = new Map();
  for (const t of data.transactions || []) {
    if (!["expense", "fee"].includes(t.type) || String(t.date || "").slice(0, 7) !== month()) continue;
    const name = t.category_name || t.category || "Otros";
    map.set(name, (map.get(name) || 0) + Math.abs(Number(t.amount || 0)));
  }
  const discretionary = /ocio|restaur|compra|viaje|entreten|suscrip/i;
  const historical = financialEngine.historicalMonthlyExpenses(data.transactions || [], 4).slice(1);
  const avg = historical.length ? historical.reduce((s, x) => s + x.expenses, 0) / historical.length : total.expenses;
  return [...map.entries()].map(([name, value]) => ({ name, value, discretionary: discretionary.test(name) })).filter(x => x.discretionary || x.value > Math.max(cfg.alertMonthlySpend || 0, avg * .25)).sort((a, b) => b.value - a.value);
}

export function analyzeFinancialRisk(data, profile = {}) {
  const cfg = settings(profile);
  const total = financialEngine.monthlyTotals(data.transactions || [], month());
  const balance = financialEngine.balances(data);
  const health = financialEngine.healthScore(data, month());
  const recurring = financialEngine.recurringPayments(data.transactions || []);
  const anomalies = financialEngine.anomalies(data.transactions || [], month());
  const duplicates = financialEngine.duplicates(data.transactions || []);
  const findings = [];
  const history = wealthChange(data);
  const monthlyExpenses = financialEngine.historicalMonthlyExpenses(data.transactions || [], 4).slice(1);
  const avgExpense = monthlyExpenses.length ? monthlyExpenses.reduce((s, x) => s + x.expenses, 0) / monthlyExpenses.length : total.expenses;
  const liquidityTarget = Math.max(cfg.minimumLiquidity, cfg.emergency * avgExpense);

  if (cfg.alerts.lowBalance && cfg.protectMinimum && cfg.minimumLiquidity > 0 && balance.liquid < cfg.minimumLiquidity) {
    findings.push({ level: "critical", kind: "lowBalance", title: "Liquidez por debajo de tu mínimo", text: `Tienes ${money(balance.liquid)} líquidos y has marcado ${money(cfg.minimumLiquidity)} como intocables.`, action: "No aumentaría el riesgo ni haría nuevas aportaciones hasta recuperar el colchón." });
  } else if (cfg.alerts.lowBalance && liquidityTarget > 0 && balance.liquid < liquidityTarget) {
    findings.push({ level: "warn", kind: "lowBalance", title: "Colchón de seguridad por debajo del objetivo", text: `Tu liquidez es ${money(balance.liquid)} y el colchón estimado objetivo es ${money(liquidityTarget)}.`, action: "Priorizaría liquidez antes de aumentar exposición a activos de riesgo." });
  }
  if (cfg.alerts.wealthDrop && history && history.ratio < -.08) findings.push({ level: "critical", kind: "wealthDrop", title: "Caída relevante del patrimonio", text: `El último registro refleja ${money(Math.abs(history.change))} menos que el anterior (${Math.round(Math.abs(history.ratio) * 100)}%).`, action: "Revisaría qué movimiento o inversión explica la caída antes de tomar nuevas decisiones." });

  if (cfg.alerts.exceptional && cfg.alertSpend > 0) {
    const big = (data.transactions || []).filter(t => ["expense", "fee"].includes(t.type) && String(t.date || "").slice(0, 7) === month() && Math.abs(Number(t.amount || 0)) >= cfg.alertSpend).sort((a, b) => Math.abs(Number(b.amount || 0)) - Math.abs(Number(a.amount || 0)))[0];
    if (big) findings.push({ level: "warn", kind: "exceptional", title: "Gasto excepcional", text: `${big.merchant || big.description || "Movimiento"} ha supuesto ${money(Math.abs(Number(big.amount || 0)))}.`, action: "Si es puntual, no lo convertiría en una conclusión estructural; si se repite, ajustaría el presupuesto." });
  }

  const cuts = categoryCuts(data, total, cfg);
  if (cfg.alerts.category && cuts[0] && total.expenses > 0 && cuts[0].value / total.expenses > .25) {
    findings.push({ level: "warn", kind: "category", title: "Aquí veo margen para recortar", text: `${cuts[0].name} concentra ${Math.round(cuts[0].value / total.expenses * 100)}% del gasto del mes (${money(cuts[0].value)}).`, action: `Buscaría un recorte del 10–20% en ${cuts[0].name} antes de tocar gastos esenciales.` });
  }
  if (cfg.alerts.category && cfg.savingsTarget > 0 && total.income > 0 && total.income - total.expenses < cfg.savingsTarget) {
    findings.push({ level: "warn", kind: "savingsTarget", title: "El ahorro del mes va por debajo de tu objetivo", text: `Llevas un ahorro estimado de ${money(total.income - total.expenses)} y tu objetivo es ${money(cfg.savingsTarget)}.`, action: "Recortaría primero categorías discrecionales antes de reducir aportaciones de largo plazo." });
  }
  if (cfg.alerts.recurring && recurring.length) {
    const r = recurring[0];
    findings.push({ level: "info", kind: "recurring", title: "Pago recurrente detectado", text: `${r.merchant}: ${money(r.amount)} aproximadamente cada ${Math.round(r.avgGap)} días.`, action: "Comprueba si sigue siendo útil; los pagos repetidos son un buen primer recorte." });
  }
  if (cfg.alerts.duplicate && duplicates.length) findings.push({ level: "warn", kind: "duplicate", title: "Posible movimiento duplicado", text: `${duplicates.length} coincidencia(s) fuerte(s) requieren revisión.`, action: "No lo eliminaría automáticamente: confirma primero que no sean cargos legítimos." });
  if (cfg.alerts.category && anomalies.length) {
    const a = anomalies[0];
    findings.push({ level: "warn", kind: "anomaly", title: "Gasto fuera de tu patrón habitual", text: `${a.merchant} aparece con ${money(a.amount)} frente a una media de ${money(a.average)}.`, action: "Si no era un gasto extraordinario, lo usaría como señal para ajustar esa categoría." });
  }

  const excluded = cfg.excludedAssets.map(x => String(x).toLowerCase());
  const cryptoValue = (data.assets || []).filter(a => a.group === "Criptomonedas").reduce((s, a) => s + Number(a.value || a.current_value || 0), 0);
  const cryptoRatio = balance.netWorth > 0 ? cryptoValue / balance.netWorth : 0;
  if (cfg.alerts.investment && excluded.some(x => x.includes("bitcoin") || x.includes("cripto")) && cryptoValue > 0) findings.push({ level: "warn", kind: "investment", title: "Hay una inversión que has excluido", text: `Criptomonedas representa aproximadamente ${Math.round(cryptoRatio * 100)}% del patrimonio registrado.`, action: "No recomendaría aumentar esa exposición; primero decidiría si quieres mantener o reducir la posición." });

  if (cfg.alerts.goal && (data.goals || []).some(g => Number(g.target_amount || 0) > Number(g.current_amount || 0) && g.date && new Date(g.date) < new Date(Date.now() + 180 * 86400000))) findings.push({ level: "warn", kind: "goal", title: "Un objetivo puede quedarse corto", text: "Hay una meta próxima a su fecha que todavía no está financiada al 100%.", action: "Separaría una aportación específica para esa meta antes de asumir más riesgo." });

  findings.sort((a, b) => ({ critical: 0, warn: 1, info: 2, good: 3 }[a.level] - ({ critical: 0, warn: 1, info: 2, good: 3 }[b.level])));
  if (!findings.length) findings.push({ level: "good", kind: "stable", title: "Situación estable", text: "No he encontrado una señal financiera que requiera actuar ahora mismo.", action: "Mantendría el plan y seguiría acumulando datos." });
  return { generatedAt: new Date().toISOString(), totals: total, balances: balance, health, findings, recurring, anomalies, duplicates, categoryCuts: cuts, wealthChange: history };
}

function fingerprint(findings) {
  return findings.filter(x => x.level === "critical").map(x => `${x.kind}:${x.title}`).join("|") || findings.filter(x => x.level === "warn").slice(0, 2).map(x => `${x.kind}:${x.title}`).join("|");
}

async function persist(patch) {
  const ctx = await getUser();
  const next = { ...(ctx.monitor || {}), ...patch };
  const r = await ctx.client.auth.updateUser({ data: { ...(ctx.user.user_metadata || {}), [MONITOR_KEY]: next } });
  if (r.error) throw r.error;
  userCache = { ...ctx, user: r.data.user, monitor: next };
}

function badge(count) {
  const node = document.getElementById("alert-count");
  if (!node) return;
  node.textContent = String(count);
  node.style.display = count ? "inline-flex" : "none";
}

function showToast(item, weekly = false) {
  document.querySelector(".fm-toast")?.remove();
  const node = document.createElement("div");
  node.className = `fm-toast ${item.level === "critical" ? "critical" : ""}`;
  node.innerHTML = `<div class="fm-toast-head"><span class="fm-toast-dot"></span>${esc(weekly ? `Revisión semanal · ${item.title}` : item.title)}</div><p>${esc(item.text)}</p><small>Haz clic para ver el análisis completo</small>`;
  node.addEventListener("click", () => { node.remove(); openPanel(); });
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 9000);
}

function item(item) {
  const label = item.level === "critical" ? "RIESGO" : item.level === "warn" ? "ATENCIÓN" : item.level === "info" ? "VIGILAR" : "OK";
  return `<article class="fm-item ${item.level}"><div class="fm-item-head"><strong>${esc(item.title)}</strong><span class="fm-pill">${label}</span></div><p>${esc(item.text)}</p><p class="fm-action">→ ${esc(item.action)}</p></article>`;
}

function openPanel() {
  injectStyle();
  document.querySelector(".fm-panel")?.remove();
  const critical = latest.daily.filter(x => x.level === "critical");
  const warnings = latest.daily.filter(x => x.level === "warn");
  const weekly = latest.weekly.length ? latest.weekly : latest.daily;
  const panel = document.createElement("div");
  panel.className = "fm-panel";
  panel.innerHTML = `<div class="fm-wrap"><header class="fm-head"><div><div class="fm-kicker">BORJAI · VIGILANCIA FINANCIERA</div><h2>Tu análisis financiero</h2><p>Control diario, revisión semanal y alertas cuando cambia tu situación.</p></div><button class="fm-close" type="button">Cerrar</button></header><div class="fm-body"><div class="fm-summary"><div class="fm-card"><strong>${critical.length}</strong><span>riesgos críticos</span></div><div class="fm-card"><strong>${warnings.length}</strong><span>puntos de atención</span></div><div class="fm-card"><strong>${latest.weekly.length ? "Al día" : "Pendiente"}</strong><span>revisión profunda semanal</span></div></div><section class="fm-section"><h3>🔴 Señales que requieren atención</h3><div class="fm-list">${critical.length ? critical.map(item).join("") : '<div class="fm-empty">No hay riesgos críticos detectados.</div>'}</div></section><section class="fm-section"><h3>🟡 Qué vigilar y dónde recortar</h3><div class="fm-list">${warnings.length ? warnings.map(item).join("") : '<div class="fm-empty">No hay puntos de atención relevantes.</div>'}</div></section><section class="fm-section"><h3>📊 Revisión profunda semanal</h3><div class="fm-list">${weekly.map(item).join("")}</div></section></div><footer class="fm-foot">Nivel 1 · al entrar en Borjai &nbsp;•&nbsp; Nivel 2 · cada 7 días &nbsp;•&nbsp; Nivel 3 · al detectar un cambio relevante.</footer></div>`;
  panel.querySelector(".fm-close").addEventListener("click", () => panel.remove());
  panel.addEventListener("click", e => { if (e.target === panel) panel.remove(); });
  document.body.appendChild(panel);
}

async function run({ reason = "open" } = {}) {
  if (busy) return;
  busy = true;
  try {
    const ctx = await getUser();
    const data = await readState();
    const analysis = analyzeFinancialRisk(data, ctx.profile);
    const previous = ctx.monitor?.lastFingerprint || "";
    const current = fingerprint(analysis.findings);
    const weeklyDue = !ctx.monitor?.lastWeeklyAt || Date.now() - new Date(ctx.monitor.lastWeeklyAt).getTime() >= WEEK;
    latest = { daily: analysis.findings, weekly: weeklyDue ? analysis.findings.slice(0, 8) : (ctx.monitor?.weeklyFindings || []), updatedAt: analysis.generatedAt };
    const critical = analysis.findings.filter(x => x.level === "critical").length;
    const warnings = analysis.findings.filter(x => x.level === "warn").length;
    await persist({ lastDailyAt: analysis.generatedAt, lastWeeklyAt: weeklyDue ? analysis.generatedAt : (ctx.monitor?.lastWeeklyAt || null), lastFingerprint: current, criticalCount: critical, warningCount: warnings, weeklyFindings: weeklyDue ? latest.weekly : (ctx.monitor?.weeklyFindings || []) });
    badge(critical + warnings);
    if (reason === "change" && current && current !== previous) {
      const urgent = analysis.findings.find(x => x.level === "critical") || analysis.findings.find(x => x.level === "warn");
      if (urgent) showToast(urgent);
    } else if (reason === "open" && weeklyDue) {
      const urgent = latest.weekly.find(x => x.level === "critical" || x.level === "warn");
      if (urgent) showToast(urgent, true);
    }
    return analysis;
  } catch (error) {
    console.warn("Borjai financial monitor:", error);
    return null;
  } finally { busy = false; }
}

function attach() {
  injectStyle();
  document.addEventListener("click", event => {
    const trigger = event.target.closest?.('[data-action="show-alerts"]');
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openPanel();
  }, true);
  window.addEventListener("borjai:state", () => run({ reason: "change" }));
  window.BORJAI_FINANCIAL_MONITOR = { analyze: run, open: openPanel, get latest() { return latest; } };
  setTimeout(() => run({ reason: "open" }), 300);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", attach, { once: true });
else attach();
