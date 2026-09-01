const ALL_CATEGORIES = ["Vivienda","Alimentacion","Restaurantes","Gasolina","Transporte","Ocio","Compras","Suscripciones","Viajes","Salud","Seguros","Formacion","Tecnologia","Inversiones","Criptomonedas","Impuestos","Otros"];

const CATEGORY_ICONS = {
  Vivienda: "home",
  Alimentacion: "cart",
  Restaurantes: "fork",
  Gasolina: "fuel",
  Transporte: "car",
  Ocio: "game",
  Compras: "bag",
  Suscripciones: "screen",
  Viajes: "plane",
  Salud: "heart",
  Seguros: "shield",
  Formacion: "book",
  Tecnologia: "laptop",
  Inversiones: "trend",
  Criptomonedas: "coin",
  Impuestos: "receipt",
  Otros: "more"
};

const ICONS = {
  wallet:'<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2zM4 8h14v5H4M16 14h.01"/>',
  trend:'<path d="m4 17 6-6 4 4 6-7M15 8h5v5"/>',
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  cart:'<path d="M3 4h2l2.2 10.2A2 2 0 0 0 9.2 16H18a2 2 0 0 0 1.9-1.4L22 8H6M10 20h.01M17 20h.01"/>',
  fork:'<path d="M7 3v7M5 3v5a2 2 0 0 0 4 0V3M7 10v11M17 3v18M17 3c3 2 3 6 0 8"/>',
  fuel:'<path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M5 17h10M8 7h4M15 7l3 3v6a2 2 0 0 0 2 2h1V11l-3-3"/>',
  car:'<path d="m5 16 1.5-6h11L19 16M4 16h16v4H4zM7 20v1M17 20v1M7 16h.01M17 16h.01"/>',
  bag:'<path d="M5 8h14l1 13H4zM8 8V6a4 4 0 0 1 8 0v2"/>',
  plane:'<path d="m3 11 18-7-7 18-3-8zM11 14l5-5"/>',
  heart:'<path d="M20.8 8.6c0 5.4-8.8 10.4-8.8 10.4S3.2 14 3.2 8.6A4.6 4.6 0 0 1 12 6a4.6 4.6 0 0 1 8.8 2.6z"/>',
  screen:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 22h8M12 19v3"/>',
  game:'<path d="M7 8h10a5 5 0 0 1 4 8l-2 3a2 2 0 0 1-3-.3L14 16h-4l-2 2.7A2 2 0 0 1 5 19l-2-3a5 5 0 0 1 4-8zM8 12v4M6 14h4M16 13h.01M19 13h.01"/>',
  shield:'<path d="M12 3 20 6v5c0 5-3.3 8.5-8 10-4.7-1.5-8-5-8-10V6zM9 12l2 2 4-4"/>',
  book:'<path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 0-4 0zM5 4v16M9 20a4 4 0 0 1 4-4h6"/>',
  laptop:'<rect x="4" y="5" width="16" height="12" rx="1"/><path d="M2 20h20M8 20l1-3h6l1 3"/>',
  coin:'<circle cx="12" cy="12" r="8"/><path d="M14.5 9.5c-.7-.7-1.6-1-2.6-1-1.3 0-2.3.7-2.3 1.7 0 2.4 5.1 1 5.1 3.5 0 1-1 1.8-2.5 1.8-1 0-2-.3-2.7-1M12 7v10"/>',
  receipt:'<path d="M5 3h14v18l-3-2-4 2-4-2-3 2zM8 8h8M8 12h8M8 16h5"/>',
  more:'<circle cx="12" cy="12" r="9"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>'
};

function icon(name) {
  return `<svg class="expense-icon" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.more}</svg>`;
}

function readState() {
  if (window.BORJAI_STATE && typeof window.BORJAI_STATE === "object") return window.BORJAI_STATE;
  try {
    const raw = localStorage.getItem("borjai:mvp:v1");
    return raw ? JSON.parse(raw) : {transactions:[]};
  } catch (_) {
    return {transactions:[]};
  }
}

function euro(value) {
  return new Intl.NumberFormat("es-ES", {style:"currency", currency:"EUR", maximumFractionDigits:2}).format(Number(value)||0).replace(/\u00a0/g," ");
}

function pct(value) {
  return new Intl.NumberFormat("es-ES",{style:"percent",maximumFractionDigits:0}).format(Number(value)||0);
}

function clean(value) {
  return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
}

function safe(value) {
  return String(value||"").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
}

function categoryData(state) {
  const map = Object.fromEntries(ALL_CATEGORIES.map(name => [name, 0]));
  (state.transactions || []).forEach(t => {
    if (t.type !== "expense" && t.type !== "fee") return;
    const name = ALL_CATEGORIES.includes(t.category) ? t.category : "Otros";
    map[name] += Math.abs(Number(t.amount)||0);
  });
  return ALL_CATEGORIES.map(name => ({name,value:map[name]})).sort((a,b) => b.value-a.value || ALL_CATEGORIES.indexOf(a.name)-ALL_CATEGORIES.indexOf(b.name));
}

function incomeTotal(state) {
  return (state.transactions || []).filter(t => t.type === "income" || t.type === "dividend").reduce((s,t)=>s+Math.max(0,Number(t.amount)||0),0);
}

function expenseTotal(state) {
  return (state.transactions || []).filter(t => t.type === "expense" || t.type === "fee").reduce((s,t)=>s+Math.abs(Number(t.amount)||0),0);
}

function isNecessary(name) {
  return ["Vivienda","Alimentacion","Gasolina","Transporte","Salud","Formacion","Seguros"].includes(name);
}

function currentMonthTransactions(state) {
  const month = new Date().toISOString().slice(0,7);
  return (state.transactions||[]).filter(t => String(t.date||"").slice(0,7) === month);
}

function polar(cx,cy,r,angle) {
  const a=(angle-90)*Math.PI/180;
  return {x:cx+r*Math.cos(a),y:cy+r*Math.sin(a)};
}

function arcPath(cx,cy,r,start,end) {
  const s=polar(cx,cy,r,end), e=polar(cx,cy,r,start), large=end-start>180?1:0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 0 ${e.x} ${e.y} L ${cx} ${cy} Z`;
}

function donutChart(categories,total) {
  const active=categories.filter(c=>c.value>0);
  if(!active.length || !total) {
    return `<svg class="expense-donut-svg" viewBox="0 0 240 240" role="img" aria-label="Sin gastos registrados"><circle cx="120" cy="120" r="92" fill="#343942"/><circle cx="120" cy="120" r="52" fill="#101318"/></svg>`;
  }
  let cursor=0;
  const paths=active.map((c,i)=>{
    const start=cursor;
    cursor += c.value/total*360;
    const color=i%2===0?"#3b3f48":"#ff2638";
    return `<path class="expense-donut-segment" data-category="${safe(c.name)}" d="${arcPath(120,120,92,start,cursor)}" fill="${color}"/>`;
  }).join("");
  return `<svg class="expense-donut-svg" viewBox="0 0 240 240" role="img" aria-label="Distribución de gastos por categoría">${paths}<circle cx="120" cy="120" r="52" fill="#101318" stroke="#20242b" stroke-width="1"/></svg>`;
}

function renderExpenseScreen(root) {
  const state = readState();
  const tx = currentMonthTransactions(state);
  const monthState = {...state, transactions:tx};
  const categories = categoryData(monthState);
  const activeCategories = categories.filter(c=>c.value>0);
  const expenses = expenseTotal(monthState);
  const income = incomeTotal(monthState);
  const necessary = categories.filter(c=>isNecessary(c.name)).reduce((s,c)=>s+c.value,0);
  const discretionary = Math.max(0, expenses-necessary);
  const top = activeCategories[0];
  const total = activeCategories.reduce((s,c)=>s+c.value,0);
  const visibleCount=6;

  const makeRows = (all) => {
    const list=all?categories:categories.filter(c=>c.value>0).slice(0,visibleCount);
    return list.map(c => `
      <button class="expense-category-row" type="button" data-category-row="${safe(c.name)}" data-value="${c.value}">
        <span class="expense-category-name">${icon(CATEGORY_ICONS[c.name]||"more")}<span>${safe(c.name)}</span></span>
        <strong>${euro(c.value)}</strong>
        <span class="expense-category-pct">${pct(total ? c.value/total : 0)}</span>
      </button>`).join("");
  };

  const recent = tx.filter(t=>t.type==="expense" || t.type==="fee").sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,6);
  const recentRows = recent.length ? recent.map(t=>`
    <tr>
      <td>${safe(String(t.date||"").slice(8,10) || "—")}/${safe(String(t.date||"").slice(5,7) || "—")}</td>
      <td><strong>${safe(t.merchant||t.description||t.category||"Gasto")}</strong></td>
      <td><span class="expense-table-category">${icon(CATEGORY_ICONS[t.category]||"more")}${safe(t.category||"Otros")}</span></td>
      <td class="align-right amount-negative">-${euro(Math.abs(Number(t.amount)||0))}</td>
      <td>Gasto</td>
    </tr>`).join("") : `<tr><td colspan="5" class="expense-table-empty">${icon("more")}<span>No hay movimientos con este filtro.</span></td></tr>`;

  root.innerHTML = `
    <section class="view expenses-redesign" data-expenses-redesign="1">
      <header class="view-head expense-redesign-head">
        <div><div class="section-kicker">ANÁLISIS DE CONSUMO</div><h1>Gastos</h1><p>Entiende a dónde se va tu dinero y qué cambios tendrían más impacto.</p></div>
        <div class="view-head-actions"><button class="btn btn-primary" data-action="movement"><span class="expense-action-icon">+</span><span>Registrar gasto</span></button></div>
      </header>

      <div class="expense-summary-grid">
        <article class="expense-kpi"><div class="expense-kpi-icon">${icon("wallet")}</div><div><span>GASTOS TOTALES</span><strong>${euro(expenses)}</strong><small>${pct(income ? expenses/income : 0)} de ingresos</small></div></article>
        <article class="expense-kpi"><div class="expense-kpi-icon">${icon("trend")}</div><div><span>INGRESOS TOTALES</span><strong>${euro(income)}</strong><small>Este mes</small></div></article>
        <article class="expense-kpi"><div class="expense-kpi-icon">${icon("home")}</div><div><span>NECESARIOS</span><strong>${euro(necessary)}</strong><small>Vivienda, servicios y básicos</small></div></article>
        <article class="expense-kpi"><div class="expense-kpi-icon">${icon("bag")}</div><div><span>DISCRECIONALES</span><strong>${euro(discretionary)}</strong><small>Ocio, compras y restaurantes</small></div></article>
        <article class="expense-kpi"><div class="expense-kpi-icon">${icon(top ? CATEGORY_ICONS[top.name]||"more" : "more")}</div><div><span>CATEGORÍA PRINCIPAL</span><strong>${top ? safe(top.name) : "—"}</strong><small>${top ? euro(top.value) : "Sin datos"}</small></div></article>
      </div>

      <div class="expense-main-grid">
        <section class="panel expense-category-panel">
          <div class="panel-head"><div><h2 class="panel-title">Gasto por categoría</h2><span class="panel-note">${new Intl.DateTimeFormat("es-ES",{month:"long",year:"numeric"}).format(new Date())}</span></div></div>
          <div class="expense-chart-content">
            <div class="expense-donut-wrap"><div class="expense-donut" data-expense-donut>${donutChart(activeCategories,total).replace("<svg","<svg")}<div class="expense-donut-center"><strong>${euro(expenses)}</strong><span>Total</span></div></div>
            <div class="expense-category-list" data-category-list>${makeRows(false)}${categories.length>visibleCount?`<button class="btn btn-small expense-all-categories" type="button" data-toggle-categories="true">Ver todas las categorías</button>`:""}</div>
          </div>
        </section>

        <aside class="panel expense-insight-panel">
          <div class="section-kicker">LECTURA DE BORJAI</div><h2 class="panel-title">Dónde actuaría primero</h2>
          <p class="panel-note">${top ? `La mayor partida es ${safe(top.name)}.` : "Añade movimientos para generar recomendaciones."}</p>
          <div class="expense-insight-row"><span>Suscripciones</span><strong>${euro(categories.find(c=>c.name==="Suscripciones")?.value||0)}</strong></div>
          <div class="expense-insight-row"><span>Restaurantes y ocio</span><strong>${euro(categories.filter(c=>["Restaurantes","Ocio"].includes(c.name)).reduce((s,c)=>s+c.value,0))}</strong></div>
          <button class="btn btn-small" data-action="ask" data-q="gastos">Pedir análisis</button>
        </aside>
      </div>

      <section class="table-shell expense-recent-panel">
        <div class="table-toolbar"><div><h2 class="panel-title">Gastos recientes</h2><span class="panel-note">Clasificación editable por ti</span></div><button class="btn btn-small" data-view="movimientos">Abrir movimientos</button></div>
        <div class="table-shell-inner"><table class="data-table"><thead><tr><th>FECHA</th><th>CONCEPTO</th><th>CATEGORÍA</th><th class="align-right">IMPORTE</th><th>TIPO</th></tr></thead><tbody>${recentRows}</tbody></table></div>
      </section>
    </section>`;
}

function injectIncomeNav() {
  const nav=document.querySelector(".side-nav");
  if(!nav || nav.querySelector('[data-view="ingresos"]')) return;
  const gastos=nav.querySelector('[data-view="gastos"]');
  const button=document.createElement("button");
  button.type="button"; button.className="nav-link"; button.dataset.view="ingresos"; button.innerHTML=`${icon("trend")}<span>Ingresos</span>`;
  if(gastos) gastos.parentNode.insertBefore(button,gastos); else nav.appendChild(button);
}

function styleApp() {
  if(document.getElementById("borjai-expenses-v4-style")) return;
  const style=document.createElement("style"); style.id="borjai-expenses-v4-style";
  style.textContent=`
    .expenses-redesign .expense-icon{width:22px;height:22px;fill:none;stroke:#ff2638;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:0 0 auto}
    .expenses-redesign .expense-kpi-icon{width:58px;height:58px;border:1px solid #ff2638;border-radius:50%;display:flex;align-items:center;justify-content:center;background:#090b0f;flex:0 0 58px}
    .expenses-redesign .expense-kpi-icon .expense-icon{width:29px;height:29px}
    .expense-action-icon{font-size:23px;line-height:1;font-weight:400}
    .expense-summary-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-top:18px}
    .expense-kpi{min-height:108px;border:1px solid #292d34;border-radius:12px;background:#101318;display:flex;align-items:center;gap:15px;padding:16px 14px;box-sizing:border-box}
    .expense-kpi>div:last-child{min-width:0}.expense-kpi span{display:block;color:#9da3ad;font-size:11px;font-weight:700;letter-spacing:.12em;margin-bottom:7px}.expense-kpi strong{display:block;color:#fff;font-size:22px;line-height:1.1;margin-bottom:5px}.expense-kpi small{display:block;color:#8e95a0;font-size:12px}
    .expense-main-grid{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:14px;margin-top:14px}
    .expense-category-panel,.expense-insight-panel{min-height:430px}
    .expense-chart-content{display:grid;grid-template-columns:42% 58%;align-items:center;min-height:350px}
    .expense-donut-wrap{position:relative;width:270px;height:270px;margin:auto;display:grid;place-items:center}
    .expense-donut-svg{width:270px;height:270px;display:block;overflow:visible}
    .expense-donut-segment{cursor:pointer;transition:opacity .15s,transform .15s;transform-origin:120px 120px}
    .expense-donut-segment:hover,.expense-donut-segment.is-active{opacity:.78}
    .expense-donut-center{position:absolute;z-index:2;display:flex;flex-direction:column;align-items:center;pointer-events:none}.expense-donut-center strong{color:#fff;font-size:27px}.expense-donut-center span{color:#8e95a0;font-size:13px;margin-top:2px}
    .expense-category-list{padding:0 24px 0 8px}.expense-category-row{width:100%;display:grid;grid-template-columns:minmax(0,1fr) 80px 44px;align-items:center;gap:8px;padding:9px 0;border:0;border-bottom:1px solid #1d2026;background:transparent;text-align:left;cursor:pointer;color:inherit}.expense-category-row:hover{background:#15181e}.expense-category-name{display:flex;align-items:center;gap:10px;color:#e8e9ec;font-size:15px}.expense-category-row strong{color:#fff;text-align:right;font-size:14px}.expense-category-pct{color:#858c97;text-align:right;font-size:13px}.expense-all-categories{width:100%;margin-top:12px}
    .expense-insight-panel{padding:22px}.expense-insight-panel .panel-title{margin-top:6px}.expense-insight-panel>p{margin:28px 0 18px}.expense-insight-row{display:flex;justify-content:space-between;padding:16px 0;border-bottom:1px solid #24272d;color:#c7cbd1;font-size:14px}.expense-insight-row strong{color:#fff}.expense-insight-panel .btn{margin-top:22px;width:100%}
    .expense-recent-panel{margin-top:14px;overflow:hidden}.expense-table-empty{height:150px;display:flex;align-items:center;justify-content:center;gap:10px;color:#8e95a0}.expense-table-empty .expense-icon{width:22px}.expense-table-category{display:inline-flex;align-items:center;gap:7px}.expense-table-category .expense-icon{width:18px;height:18px}
    .expense-redesign-head .btn{display:flex;align-items:center;gap:8px}
    .side-nav [data-view="ingresos"] svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    @media(max-width:1100px){.expense-summary-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.expense-main-grid{grid-template-columns:1fr}.expense-chart-content{grid-template-columns:1fr}.expense-donut-wrap{margin:22px auto}.expense-category-list{padding:0 18px 18px}}
    @media(max-width:700px){.expense-summary-grid{grid-template-columns:1fr}.expense-kpi{min-height:96px}.expense-donut-wrap{width:220px;height:220px}.expense-donut-svg{width:220px;height:220px}}
  `;
  document.head.appendChild(style);
}

let expanded=false;
let selectedCategory="";

function decorate() {
  styleApp();
  injectIncomeNav();
  const root=document.getElementById("app-view");
  if(!root) return;
  const heading=root.querySelector(".view h1");
  if(heading && clean(heading.textContent)==="gastos" && !root.querySelector("[data-expenses-redesign]")) {
    expanded=false; selectedCategory=""; renderExpenseScreen(root);
  }
}

function highlightCategory(name) {
  selectedCategory=name;
  document.querySelectorAll("[data-category-row]").forEach(row=>row.classList.toggle("is-active",row.dataset.categoryRow===name));
  document.querySelectorAll("[data-category]").forEach(path=>path.classList.toggle("is-active",path.dataset.category===name));
}

document.addEventListener("click",function(e){
  const toggle=e.target.closest("[data-toggle-categories]");
  if(toggle){
    const root=document.querySelector("[data-expenses-redesign]");
    if(!root) return;
    expanded=!expanded;
    const state=readState();
    const tx=currentMonthTransactions(state);
    const monthState={...state,transactions:tx};
    const categories=categoryData(monthState);
    const total=categories.reduce((s,c)=>s+c.value,0);
    const list=root.querySelector("[data-category-list]");
    if(list){
      const rows=(expanded?categories:categories.filter(c=>c.value>0).slice(0,6)).map(c=>`<button class="expense-category-row${selectedCategory===c.name?" is-active":""}" type="button" data-category-row="${safe(c.name)}"><span class="expense-category-name">${icon(CATEGORY_ICONS[c.name]||"more")}<span>${safe(c.name)}</span></span><strong>${euro(c.value)}</strong><span class="expense-category-pct">${pct(total?c.value/total:0)}</span></button>`).join("");
      list.innerHTML=rows+`<button class="btn btn-small expense-all-categories" type="button" data-toggle-categories="true">${expanded?"Ocultar categorías":"Ver todas las categorías"}</button>`;
    }
    return;
  }

  const row=e.target.closest("[data-category-row]");
  if(row){highlightCategory(row.dataset.categoryRow);return;}

  const segment=e.target.closest("[data-category]");
  if(segment){highlightCategory(segment.dataset.category);return;}
});

window.addEventListener("borjai:state",function(){
  const root=document.querySelector("[data-expenses-redesign]");
  if(root){expanded=false;selectedCategory="";renderExpenseScreen(root);}
});

const observer=new MutationObserver(()=>{
  injectIncomeNav();
  const root=document.getElementById("app-view");
  if(!root) return;
  const heading=root.querySelector(".view h1");
  if(heading && clean(heading.textContent)==="gastos" && !root.querySelector("[data-expenses-redesign]")) renderExpenseScreen(root);
});

observer.observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener("DOMContentLoaded",decorate);
decorate();
