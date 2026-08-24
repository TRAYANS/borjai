const KEY = "borjai:mvp:v1";
const GROUPS = [
  { name: "EE.UU.", items: [["S&P 500", "^GSPC"], ["Nasdaq 100", "^NDX"], ["Dow Jones", "^DJI"], ["Russell 2000", "^RUT"]] },
  { name: "Europa", items: [["Euro Stoxx 50", "^STOXX50E"], ["IBEX 35", "^IBEX"], ["DAX", "^GDAXI"], ["CAC 40", "^FCHI"], ["FTSE 100", "^FTSE"]] },
  { name: "Asia", items: [["Nikkei 225", "^N225"], ["Hang Seng", "^HSI"], ["Shanghai Composite", "000001.SS"], ["KOSPI", "^KS11"], ["Nifty 50", "^NSEI"]] },
  { name: "Global", items: [["MSCI World", "URTH"], ["MSCI ACWI", "ACWI"], ["Emergentes", "EEM"]] },
  { name: "LatAm", items: [["Brasil", "^BVSP"], ["México", "^MXX"]] },
  { name: "Materias primas", items: [["Oro", "GC=F"], ["Plata", "SI=F"], ["Petróleo WTI", "CL=F"]] },
  { name: "Divisas", items: [["EUR / USD", "EURUSD=X"], ["GBP / EUR", "GBPEUR=X"]] },
  { name: "Cripto", items: [["Bitcoin", "bitcoin"], ["Ethereum", "ethereum"]] }
];
const IDEAS = [
  ["MSCI World", "URTH", "ETF global", "Moderado", "Diversificación mundial amplia."],
  ["S&P 500", "SPY", "ETF EE.UU.", "Moderado", "Grandes compañías estadounidenses."],
  ["MSCI Emerging Markets", "EEM", "ETF emergentes", "Alto", "Complemento geográfico para diversificar."],
  ["Nasdaq 100", "QQQ", "ETF crecimiento", "Alto", "Mayor exposición a tecnología y crecimiento."],
  ["Euro Stoxx 50", "FEZ", "ETF Europa", "Moderado", "Exposición a grandes empresas europeas."],
  ["Oro", "GC=F", "Materia prima", "Moderado", "Activo diversificador en la cartera."]
];
let active = "Todos";

function esc(v) { return String(v ?? "").replace(/[&<>\"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;" }[c])); }
function fmt(v) { return Number.isFinite(Number(v)) ? new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v)) : "—"; }
function pct(v) { return Number.isFinite(Number(v)) ? `${Number(v) >= 0 ? "+" : ""}${fmt(v)}%` : "—"; }
function readState() { try { return JSON.parse(localStorage.getItem(KEY) || "null") || {}; } catch (_) { return {}; } }
function symbols() { return GROUPS.flatMap(g => g.items.map(([name, symbol]) => ({ name, symbol, region: g.name, kind: g.name === "Cripto" ? "crypto" : "yahoo" }))); }
function portfolio() {
  const state = readState();
  return (state.assets || []).filter(a => a.ticker).map(a => ({ name: a.name, symbol: a.ticker, value: Number(a.value || 0), kind: /^(BTC|ETH)$/i.test(a.ticker) ? "crypto" : "yahoo", region: "Mi cartera" }));
}
function injectStyles() {
  if (document.getElementById("markets-v14-style")) return;
  const s = document.createElement("style"); s.id = "markets-v14-style";
  s.textContent = `.markets-toolbar{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;flex-wrap:wrap}.markets-status{color:#9da3ad;font-size:13px}.market-actions{display:flex;gap:8px;align-items:center}.markets-tabs{display:flex;gap:7px;overflow:auto;margin:18px 0}.markets-tab{border:1px solid #292c33;background:#111318;color:#bfc4cc;padding:8px 12px;border-radius:999px;cursor:pointer;white-space:nowrap}.markets-tab.active{background:#f32d3a;color:#fff;border-color:#f32d3a}.markets-grid,.ideas-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.market-card,.idea-card{padding:16px;border:1px solid #292c33;border-radius:16px;background:#111318}.market-card h3,.idea-card h3{margin:5px 0 8px;font-size:15px}.market-symbol,.market-region{color:#8d939d;font-size:11px}.market-price{font-size:23px;font-weight:750;margin:12px 0 3px}.market-change{font-size:13px;font-weight:650}.market-positive{color:#42c58a}.market-negative{color:#f05b66}.market-flat{color:#9da3ad}.markets-search{width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid #383c45;background:#090a0d;color:#fff;margin-bottom:12px}.ideas-grid{grid-template-columns:repeat(3,minmax(0,1fr));margin-top:12px}.idea-card p{color:#9da3ad;font-size:13px;line-height:1.45}.idea-meta{display:flex;justify-content:space-between;color:#8d939d;font-size:12px}.market-error{font-size:12px;color:#9da3ad}.market-disclaimer{color:#8d939d;font-size:12px;margin-top:14px}@media(max-width:1000px){.markets-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.markets-grid,.ideas-grid{grid-template-columns:1fr}}`;
  document.head.appendChild(s);
}
async function quote(item) {
  const response = await fetch(`/api/markets?symbol=${encodeURIComponent(item.symbol)}&kind=${encodeURIComponent(item.kind)}`, { cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Cotización no disponible.");
  return payload;
}
function card(a, x) {
  return `<article class="market-card"><span class="market-symbol">${esc(a.symbol)}</span><span class="market-region"> · ${esc(a.region)}</span><h3>${esc(a.name)}</h3><div class="market-price">${x ? fmt(x.price) : "—"}</div><div class="market-change ${x && x.change > 0 ? "market-positive" : x && x.change < 0 ? "market-negative" : "market-flat"}">${x ? pct(x.change) : "Cargando…"}</div></article>`;
}
async function fill(list, root) {
  root.innerHTML = list.map(item => card(item, null)).join("");
  let ok = 0;
  for (let i = 0; i < list.length; i += 1) {
    try { const x = await quote(list[i]); root.children[i].outerHTML = card(list[i], x); ok += 1; }
    catch (_) { root.children[i].querySelector(".market-change").textContent = "No disponible"; }
  }
  return ok;
}
function ideas() {
  const state = readState();
  const assets = state.assets || [];
  const total = assets.reduce((s, a) => s + Number(a.value || 0), 0) || 1;
  const crypto = assets.filter(a => a.group === "Criptomonedas").reduce((s, a) => s + Number(a.value || 0), 0);
  return IDEAS.map((x, i) => ({ name:x[0], symbol:x[1], type:x[2], risk:x[3], reason:x[4], score:Math.max(50, Math.min(95, 76 - i * 3 + (crypto / total > .15 && i < 3 ? 6 : 0))) })).sort((a,b) => b.score-a.score).slice(0,4);
}
async function renderMarkets() {
  injectStyles();
  const root = document.getElementById("app-view"); if (!root) return;
  root.innerHTML = `<section class="view"><div class="markets-toolbar"><div><div class="section-kicker">Mercados internacionales</div><h1>Mercados</h1><p>Cotizaciones, regiones y candidatos de análisis.</p></div><div class="market-actions"><span id="markets-status" class="markets-status">Preparado</span><button class="btn btn-small" id="markets-refresh">Actualizar</button></div></div><div class="markets-tabs" id="markets-tabs"></div><input id="markets-search" class="markets-search" placeholder="Buscar mercado o ticker…" autocomplete="off"><section class="portfolio-market"><div class="section-kicker">Mi cartera</div><h2>Mis activos</h2><div id="portfolio-grid" class="markets-grid"></div></section><section style="margin-top:24px"><div class="section-kicker">Mercados</div><h2>Panorama internacional</h2><div id="markets-grid" class="markets-grid"></div></section><section class="panel" style="margin-top:24px;padding:18px"><div class="section-kicker">Agente IA</div><h2 style="margin:5px 0">Oportunidades para analizar</h2><p class="panel-note">Candidatos de análisis según diversificación y perfil. No ejecuta órdenes.</p><div id="ideas-grid" class="ideas-grid"></div></section><p class="market-disclaimer">Las cotizaciones se obtienen desde el backend y se cachean brevemente para evitar dependencias CORS del navegador.</p></section>`;
  const tabs = ["Todos", ...GROUPS.map(g => g.name)];
  document.getElementById("markets-tabs").innerHTML = tabs.map(t => `<button class="markets-tab ${t===active?"active":""}" data-region="${esc(t)}">${esc(t)}</button>`).join("");
  document.querySelectorAll(".markets-tab").forEach(b => b.onclick = () => { active = b.dataset.region; renderMarkets(); });
  document.getElementById("markets-refresh").onclick = loadQuotes;
  document.getElementById("markets-search").oninput = loadQuotes;
  document.getElementById("ideas-grid").innerHTML = ideas().map(x => `<article class="idea-card"><div class="idea-meta"><span>${esc(x.type)}</span><b>Score ${x.score}/100</b></div><h3>${esc(x.name)} <span class="market-symbol">${esc(x.symbol)}</span></h3><p>${esc(x.reason)}</p><div class="idea-meta"><span>Riesgo: ${esc(x.risk)}</span><span>Para analizar</span></div></article>`).join("");
  await loadQuotes();
}
async function loadQuotes() {
  const grid = document.getElementById("markets-grid"); const pgrid = document.getElementById("portfolio-grid"); const status = document.getElementById("markets-status"); const search = document.getElementById("markets-search");
  if (!grid || !pgrid) return;
  const q = String(search?.value || "").toLowerCase();
  const list = symbols().filter(a => (active === "Todos" || a.region === active) && (!q || a.name.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q)));
  const ok = await fill(list, grid);
  const assets = portfolio().filter(a => !q || a.name.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q));
  await fill(assets, pgrid);
  status.textContent = `${ok}/${list.length} mercados disponibles · ${new Date().toLocaleTimeString("es-ES", { hour:"2-digit", minute:"2-digit" })}`;
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest('[data-view="mercados"]');
  if (!nav) return;
  event.preventDefault(); event.stopImmediatePropagation();
  document.querySelectorAll("[data-view]").forEach(n => n.classList.toggle("is-active", n === nav));
  renderMarkets();
}, true);
window.BORJAI_MARKETS_V14 = { render: renderMarkets, refresh: loadQuotes };
