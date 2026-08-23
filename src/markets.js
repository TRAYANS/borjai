const CONFIG_KEY = "borjai:markets:config";
const API_BASE = "https://www.alphavantage.co/query";
const COINGECKO = "https://api.coingecko.com/api/v3";

const ASSETS = [
  { id: "sp500", name: "S&P 500", symbol: "SPY", source: "av", note: "ETF proxy" },
  { id: "nasdaq", name: "Nasdaq 100", symbol: "QQQ", source: "av", note: "ETF proxy" },
  { id: "euro", name: "Euro Stoxx 50", symbol: "FEZ", source: "av", note: "ETF proxy" },
  { id: "world", name: "MSCI World", symbol: "URTH", source: "av", note: "ETF proxy" },
  { id: "btc", name: "Bitcoin", symbol: "bitcoin", source: "cg", currency: "eur" },
  { id: "eth", name: "Ethereum", symbol: "ethereum", source: "cg", currency: "eur" },
  { id: "gold", name: "Oro", symbol: "GOLD", source: "gold" },
  { id: "eurusd", name: "EUR / USD", symbol: "EURUSD", source: "fx" }
];

function getConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}"); } catch (_) { return {}; }
}
function setConfig(v) { localStorage.setItem(CONFIG_KEY, JSON.stringify(v)); }
function esc(v) { return String(v ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])); }
function fmt(v, digits = 2) {
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("es-ES", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v);
}
function pct(v) { return Number.isFinite(v) ? `${v >= 0 ? "+" : ""}${fmt(v)}%` : "—"; }
function cls(v) { return v > 0 ? "market-positive" : v < 0 ? "market-negative" : "market-flat"; }

async function alpha(functionName, params = {}) {
  const key = getConfig().alphaVantageKey;
  if (!key) throw new Error("Falta la API key de Alpha Vantage.");
  const q = new URLSearchParams({ function: functionName, apikey: key, ...params });
  const res = await fetch(`${API_BASE}?${q}`);
  if (!res.ok) throw new Error(`Alpha Vantage HTTP ${res.status}`);
  const data = await res.json();
  if (data.Note) throw new Error("Límite de API alcanzado.");
  if (data.Information) throw new Error(data.Information);
  return data;
}

async function quote(a) {
  if (a.source === "cg") {
    const r = await fetch(`${COINGECKO}/simple/price?ids=${encodeURIComponent(a.symbol)}&vs_currencies=eur&include_24hr_change=true`);
    if (!r.ok) throw new Error(`CoinGecko HTTP ${r.status}`);
    const d = await r.json();
    const x = d[a.symbol];
    if (!x) throw new Error("Activo no encontrado");
    return { price: x.eur, change: x.eur_24h_change, updated: new Date() };
  }
  if (a.source === "gold") {
    const d = await alpha("GOLD_SILVER_SPOT", { symbol: "GOLD" });
    const x = d.data?.find?.(z => z.symbol === "GOLD") || d.data?.[0];
    if (!x) throw new Error("Oro no disponible");
    return { price: Number(x.value), change: null, updated: x.last_refreshed || new Date() };
  }
  if (a.source === "fx") {
    const d = await alpha("CURRENCY_EXCHANGE_RATE", { from_currency: "EUR", to_currency: "USD" });
    const x = d["Realtime Currency Exchange Rate"];
    if (!x) throw new Error("EUR/USD no disponible");
    return { price: Number(x["5. Exchange Rate"]), change: null, updated: x["6. Last Refreshed"] || new Date() };
  }
  const d = await alpha("GLOBAL_QUOTE", { symbol: a.symbol });
  const x = d["Global Quote"];
  if (!x || !x["05. price"]) throw new Error("Cotización no disponible");
  return { price: Number(x["05. price"]), change: Number(x["10. change percent"]?.replace("%", "")), updated: x["07. latest trading day"] || new Date() };
}

function injectStyles() {
  if (document.getElementById("markets-v13-style")) return;
  const s = document.createElement("style"); s.id = "markets-v13-style";
  s.textContent = `
    .markets-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-top:18px}
    .market-card{padding:18px;border:1px solid #292c33;border-radius:16px;background:#111318}
    .market-card h3{margin:0 0 8px;font-size:15px}.market-symbol{color:#8d939d;font-size:12px}.market-price{font-size:25px;font-weight:750;margin:12px 0 4px}.market-change{font-size:13px;font-weight:650}.market-positive{color:#42c58a}.market-negative{color:#f05b66}.market-flat{color:#9da3ad}
    .markets-toolbar{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap}.markets-status{color:#9da3ad;font-size:13px}.market-config{margin-top:18px;padding:18px;border:1px solid #292c33;border-radius:16px;background:#0f1115}.market-config input{width:min(420px,100%);box-sizing:border-box;padding:11px;border-radius:9px;border:1px solid #383c45;background:#090a0d;color:#fff}.market-config small{display:block;color:#8d939d;margin-top:8px}.market-actions{display:flex;gap:8px;align-items:center}.market-empty{padding:28px;text-align:center;color:#9da3ad;border:1px dashed #383c45;border-radius:14px}
    @media(max-width:1000px){.markets-grid{grid-template-columns:repeat(2,minmax(0,1fr))}} @media(max-width:600px){.markets-grid{grid-template-columns:1fr}}
  `; document.head.appendChild(s);
}

async function renderMarkets() {
  injectStyles();
  const root = document.getElementById("app-view");
  if (!root) return;
  root.innerHTML = `<section class="view"><div class="markets-toolbar"><div><div class="section-kicker">Datos de mercado</div><h1 style="margin:5px 0">Mercados</h1><p class="panel-note">Cotizaciones y contexto de mercado para complementar tu cartera.</p></div><div class="market-actions"><span id="markets-status" class="markets-status">Cargando…</span><button class="btn btn-small" id="markets-refresh">Actualizar</button></div></div><div id="markets-grid" class="markets-grid"></div><section class="market-config"><strong>Conexión de mercado</strong><p class="panel-note">Alpha Vantage aporta índices/ETF, oro y EUR/USD. Bitcoin y Ethereum se consultan mediante CoinGecko.</p><div style="margin-top:12px"><input id="alpha-key" type="password" placeholder="API key de Alpha Vantage" autocomplete="off"><button class="btn btn-primary btn-small" id="alpha-save" style="margin-left:8px">Guardar API key</button></div><small>La clave se guarda solo en este navegador. Para producción multiusuario la moveremos a un backend seguro.</small></section><p class="disclaimer" style="margin-top:14px">Los datos pueden ser retrasados según el proveedor y no constituyen asesoramiento financiero.</p></section>`;
  const cfg = getConfig();
  document.getElementById("alpha-key").value = cfg.alphaVantageKey || "";
  document.getElementById("alpha-save").onclick = () => { setConfig({ ...getConfig(), alphaVantageKey: document.getElementById("alpha-key").value.trim() }); loadQuotes(); };
  document.getElementById("markets-refresh").onclick = loadQuotes;
  await loadQuotes();
}

async function loadQuotes() {
  const grid = document.getElementById("markets-grid"), status = document.getElementById("markets-status");
  if (!grid) return;
  grid.innerHTML = ASSETS.map(a => `<article class="market-card" id="market-${a.id}"><span class="market-symbol">${esc(a.symbol)}</span><h3>${esc(a.name)}</h3><div class="market-price">—</div><div class="market-change market-flat">Cargando…</div></article>`).join("");
  let ok = 0;
  for (const a of ASSETS) {
    const card = document.getElementById(`market-${a.id}`);
    try {
      const q = await quote(a); ok++;
      card.querySelector(".market-price").textContent = a.source === "fx" ? fmt(q.price, 4) : fmt(q.price);
      const change = card.querySelector(".market-change"); change.textContent = q.change == null ? "Dato disponible" : pct(q.change); change.className = `market-change ${cls(q.change)}`;
    } catch (e) {
      card.querySelector(".market-change").textContent = e.message;
      card.querySelector(".market-change").className = "market-change market-flat";
    }
  }
  status.textContent = `${ok}/${ASSETS.length} mercados disponibles · ${new Date().toLocaleTimeString("es-ES", {hour:"2-digit", minute:"2-digit"})}`;
}

function installNav() {
  if (document.querySelector('[data-view="mercados"]')) return;
  const nav = document.querySelector(".side-nav");
  if (!nav) return;
  const b = document.createElement("button"); b.type="button"; b.className="nav-link"; b.dataset.view="mercados"; b.innerHTML='<span>📈</span>Mercados';
  b.addEventListener("click", e => { e.preventDefault(); document.querySelectorAll("[data-view]").forEach(n=>n.classList.toggle("is-active", n===b)); renderMarkets(); window.scrollTo({top:0,behavior:"smooth"}); });
  nav.appendChild(b);
}

function boot() { installNav(); if (location.hash === "#mercados") renderMarkets(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
window.BORJAI_MARKETS_V13 = { render: renderMarkets, refresh: loadQuotes };
