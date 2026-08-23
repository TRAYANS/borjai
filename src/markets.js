const YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/";
const COINGECKO = "https://api.coingecko.com/api/v3";
const MARKET_GROUPS = [
  {id:"us",name:"EE.UU.",items:[["S&P 500","^GSPC"],["Nasdaq 100","^NDX"],["Dow Jones","^DJI"],["Russell 2000","^RUT"]]},
  {id:"eu",name:"Europa",items:[["Euro Stoxx 50","^STOXX50E"],["IBEX 35","^IBEX"],["DAX","^GDAXI"],["CAC 40","^FCHI"],["FTSE 100","^FTSE"]]},
  {id:"asia",name:"Asia",items:[["Nikkei 225","^N225"],["Hang Seng","^HSI"],["Shanghai Composite","000001.SS"],["KOSPI","^KS11"],["Nifty 50","^NSEI"]]},
  {id:"global",name:"Global",items:[["MSCI World","URTH"],["MSCI ACWI","ACWI"],["Emergentes","EEM"]]},
  {id:"latam",name:"LatAm",items:[["Brasil","^BVSP"],["México","^MXX"]]},
  {id:"commodities",name:"Materias primas",items:[["Oro","GC=F"],["Plata","SI=F"],["Petróleo WTI","CL=F"]]},
  {id:"fx",name:"Divisas",items:[["EUR / USD","EURUSD=X"],["GBP / EUR","GBPEUR=X"]]},
  {id:"crypto",name:"Cripto",items:[["Bitcoin","BTC-USD"],["Ethereum","ETH-USD"]]}
];
const IDEAS = [
  ["MSCI World","URTH","ETF global","Moderado","Diversificación mundial amplia."],
  ["S&P 500","SPY","ETF EE.UU.","Moderado","Grandes compañías estadounidenses."],
  ["MSCI Emerging Markets","EEM","ETF emergentes","Alto","Complemento geográfico para diversificar."],
  ["Nasdaq 100","QQQ","ETF crecimiento","Alto","Mayor exposición a tecnología y crecimiento."],
  ["Euro Stoxx 50","FEZ","ETF Europa","Moderado","Exposición diversificada a grandes empresas europeas."],
  ["Oro","GC=F","Materia prima","Moderado","Activo diversificador en la cartera."]
];
let activeRegion="Todos";
let lastState=null;
function esc(v){return String(v??"").replace(/[&<>\"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]))}
function fmt(v,d=2){return Number.isFinite(v)?new Intl.NumberFormat("es-ES",{minimumFractionDigits:d,maximumFractionDigits:d}).format(v):"—"}
function pct(v){return Number.isFinite(v)?`${v>=0?"+":""}${fmt(v)}%`:"—"}
function cls(v){return v>0?"market-positive":v<0?"market-negative":"market-flat"}
async function yahoo(symbol){
  const url=YAHOO+encodeURIComponent(symbol)+"?range=1d&interval=5m&includePrePost=false";
  const r=await fetch(url,{headers:{accept:"application/json"}});
  if(!r.ok)throw new Error("Cotización no disponible");
  const d=await r.json(),m=d?.chart?.result?.[0]?.meta;
  if(!m)throw new Error("Sin datos");
  const price=Number(m.regularMarketPrice ?? m.previousClose);
  const prev=Number(m.chartPreviousClose ?? m.previousClose);
  return {price,change:prev?((price-prev)/prev)*100:NaN,currency:m.currency||""};
}
async function crypto(id){
  const r=await fetch(`${COINGECKO}/simple/price?ids=${id}&vs_currencies=eur&include_24hr_change=true`);
  if(!r.ok)throw new Error("Cripto no disponible");
  const x=(await r.json())[id]; if(!x)throw new Error("Cripto no disponible");
  return {price:Number(x.eur),change:Number(x.eur_24h_change),currency:"EUR"};
}
function allMarkets(){return MARKET_GROUPS.flatMap(g=>g.items.map(([name,symbol])=>({name,symbol,region:g.name,crypto:g.id==="crypto"})))}
function portfolioAssets(state){
  const assets=Array.isArray(state?.assets)?state.assets:[];
  return assets.filter(a=>a.ticker).map(a=>({name:a.name,symbol:a.ticker,region:"Mi cartera",value:Number(a.value||0),crypto:/^(BTC|ETH)$/i.test(a.ticker)}));
}
function injectStyles(){if(document.getElementById("markets-v13-style"))return;const s=document.createElement("style");s.id="markets-v13-style";s.textContent=`.markets-toolbar{display:flex;justify-content:space-between;gap:16px;align-items:flex-end;flex-wrap:wrap}.markets-status{color:#9da3ad;font-size:13px}.market-actions{display:flex;gap:8px;align-items:center}.markets-tabs{display:flex;gap:7px;overflow:auto;margin:18px 0}.markets-tab{border:1px solid #292c33;background:#111318;color:#bfc4cc;padding:8px 12px;border-radius:999px;cursor:pointer;white-space:nowrap}.markets-tab.active{background:#f32d3a;color:#fff;border-color:#f32d3a}.markets-grid,.ideas-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.market-card,.idea-card{padding:16px;border:1px solid #292c33;border-radius:16px;background:#111318}.market-card h3,.idea-card h3{margin:5px 0 8px;font-size:15px}.market-symbol,.market-region{color:#8d939d;font-size:11px}.market-price{font-size:23px;font-weight:750;margin:12px 0 3px}.market-change{font-size:13px;font-weight:650}.market-positive{color:#42c58a}.market-negative{color:#f05b66}.market-flat{color:#9da3ad}.markets-search{width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1px solid #383c45;background:#090a0d;color:#fff;margin-bottom:12px}.ideas-grid{grid-template-columns:repeat(3,minmax(0,1fr));margin-top:12px}.idea-card p{color:#9da3ad;font-size:13px;line-height:1.45}.idea-meta{display:flex;justify-content:space-between;color:#8d939d;font-size:12px}.portfolio-market{margin-top:24px}.portfolio-market .market-card{border-color:#3a3f49}.market-error{font-size:12px;color:#9da3ad}.market-disclaimer{color:#8d939d;font-size:12px;margin-top:14px}@media(max-width:1000px){.markets-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.markets-grid,.ideas-grid{grid-template-columns:1fr}}`;document.head.appendChild(s)}
function card(a,x){return `<article class="market-card"><span class="market-symbol">${esc(a.symbol)}</span><span class="market-region"> · ${esc(a.region)}</span><h3>${esc(a.name)}</h3><div class="market-price">${x?fmt(x.price):"—"}</div><div class="market-change ${x?cls(x.change):"market-flat"}">${x?pct(x.change):"Cargando…"}</div></article>`}
async function loadSection(list,root,loader){root.innerHTML=list.map(a=>card(a,null)).join("");let ok=0;for(let i=0;i<list.length;i++){try{const x=await loader(list[i]);root.children[i].outerHTML=card(list[i],x);ok++}catch(e){root.children[i].querySelector(".market-change").innerHTML=`<span class="market-error">${esc(e.message)}</span>`}}return ok}
function ideas(state){
  const assets=Array.isArray(state?.assets)?state.assets:[],crypto=assets.filter(a=>a.group==="Criptomonedas").reduce((s,a)=>s+Number(a.value||0),0),total=assets.reduce((s,a)=>s+Number(a.value||0),0)||1;
  return IDEAS.map((x,i)=>({name:x[0],symbol:x[1],type:x[2],risk:x[3],reason:x[4],score:Math.max(50,Math.min(95,76-i*3+(crypto/total>.15&&i<3?6:0)))})).sort((a,b)=>b.score-a.score).slice(0,4);
}
export async function renderMarkets(state){
  lastState=state||lastState;injectStyles();const root=document.getElementById("app-view");if(!root)return;
  root.innerHTML=`<section class="view"><div class="markets-toolbar"><div><div class="section-kicker">Mercados internacionales</div><h1>Mercados</h1><p>Bolsas, divisas, materias primas y cripto en un solo lugar.</p></div><div class="market-actions"><span id="markets-status" class="markets-status">Preparado</span><button class="btn btn-small" id="markets-refresh">Actualizar</button></div></div><div class="markets-tabs" id="markets-tabs"></div><input id="markets-search" class="markets-search" placeholder="Buscar mercado o ticker…" autocomplete="off"><section id="portfolio-market" class="portfolio-market"><div class="section-kicker">Mi cartera</div><h2>Mis activos</h2><div id="portfolio-grid" class="markets-grid"></div></section><section style="margin-top:24px"><div class="section-kicker">Mercados</div><h2>Panorama internacional</h2><div id="markets-grid" class="markets-grid"></div></section><section class="panel" style="margin-top:24px;padding:18px"><div class="section-kicker">Agente IA</div><h2 style="margin:5px 0">Oportunidades para analizar</h2><p class="panel-note">Son candidatos de análisis basados en diversificación y riesgo. No son órdenes ni recomendaciones personalizadas de compra.</p><div id="ideas-grid" class="ideas-grid"></div></section><p class="market-disclaimer">Las cotizaciones proceden de fuentes externas y pueden tener retraso. Yahoo Finance no ofrece una API pública oficial de Finanzas; este módulo usa sus endpoints públicos no documentados, por lo que puede cambiar sin aviso.</p></section>`;
  const tabs=["Todos",...MARKET_GROUPS.map(x=>x.name)];document.getElementById("markets-tabs").innerHTML=tabs.map(r=>`<button class="markets-tab ${r===activeRegion?"active":""}" data-region="${esc(r)}">${esc(r)}</button>`).join("");document.querySelectorAll(".markets-tab").forEach(b=>b.onclick=()=>{activeRegion=b.dataset.region;renderMarkets(lastState)});
  document.getElementById("markets-refresh").onclick=loadQuotes;document.getElementById("markets-search").oninput=loadQuotes;
  document.getElementById("ideas-grid").innerHTML=ideas(lastState).map(x=>`<article class="idea-card"><div class="idea-meta"><span>${esc(x.type)}</span><b>Score ${x.score}/100</b></div><h3>${esc(x.name)} <span class="market-symbol">${esc(x.symbol)}</span></h3><p>${esc(x.reason)}</p><div class="idea-meta"><span>Riesgo: ${esc(x.risk)}</span><span>Para analizar</span></div></article>`).join("");
  await loadQuotes();
}
async function loadQuotes(){
  const grid=document.getElementById("markets-grid"),pgrid=document.getElementById("portfolio-grid"),status=document.getElementById("markets-status"),search=document.getElementById("markets-search");if(!grid)return;
  const q=String(search?.value||"").toLowerCase();let list=allMarkets().filter(a=>(activeRegion==="Todos"||a.region===activeRegion)&&(!q||a.name.toLowerCase().includes(q)||a.symbol.toLowerCase().includes(q)));
  if(!list.length)grid.innerHTML='<div class="panel-note">No hay mercados con ese filtro.</div>';
  const loader=a=>a.crypto?crypto(a.symbol):yahoo(a.symbol);const ok=await loadSection(list,grid,loader);
  const assets=portfolioAssets(lastState).filter(a=>!q||a.name.toLowerCase().includes(q)||a.symbol.toLowerCase().includes(q));
  await loadSection(assets,pgrid,a=>a.crypto?crypto(a.symbol==="BTC"?"bitcoin":"ethereum"):yahoo(a.symbol));
  status.textContent=`${ok}/${list.length} mercados disponibles · ${new Date().toLocaleTimeString("es-ES",{hour:"2-digit",minute:"2-digit"})}`;
}
document.addEventListener("click",function(e){const v=e.target.closest('[data-view="mercados"]');if(!v)return;e.preventDefault();e.stopImmediatePropagation();document.querySelectorAll("[data-view]").forEach(n=>n.classList.toggle("is-active",n===v));renderMarkets(window.BORJAI_APP_STATE);},{capture:true});
window.BORJAI_MARKETS_V13={render:renderMarkets,refresh:loadQuotes};
