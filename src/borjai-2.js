import { loadRuntimeConfig, hasSupabaseConfig } from "./config.js";
import { createSupabaseClient } from "./db/supabaseClient.js";

const STYLE_ID = "borjai-2-style";
const PANEL_ID = "borjai-2-panel";
const NAV_ID = "borjai-2-nav";
const euro = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 });
const today = () => new Date().toISOString().slice(0, 10);
const month = (d = new Date()) => d.toISOString().slice(0, 7);
const clean = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const money = v => euro.format(Number(v || 0));
const percent = v => pct.format(Number(v || 0));
const daysAgo = (date) => Math.round((Date.now() - new Date(String(date).slice(0,10) + "T12:00:00").getTime()) / 86400000);

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .b2-panel{position:fixed;inset:0;z-index:120;background:#090a0d;color:#f5f7fa;overflow:auto;padding:28px 28px 50px;font-family:inherit}
    .b2-wrap{max-width:1420px;margin:0 auto}.b2-top{display:flex;align-items:flex-start;justify-content:space-between;gap:20px;margin-bottom:24px}.b2-kicker{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#8f96a3;font-weight:800}.b2-top h1{margin:5px 0 6px;font-size:32px;letter-spacing:-.04em}.b2-top p{margin:0;color:#8f96a3}.b2-close{border:1px solid #2c3038;background:#15181d;color:#dfe3e8;border-radius:10px;padding:10px 14px;cursor:pointer}.b2-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:18px}.b2-card{background:#111419;border:1px solid #242831;border-radius:16px;padding:18px;box-shadow:0 8px 30px rgba(0,0,0,.14)}.b2-label{font-size:12px;color:#8f96a3}.b2-value{font-size:26px;font-weight:800;margin-top:7px;letter-spacing:-.03em}.b2-sub{font-size:12px;color:#8f96a3;margin-top:6px}.b2-good{color:#3bd486}.b2-warn{color:#ffbf4b}.b2-bad{color:#ff5965}.b2-sections{display:grid;grid-template-columns:1.1fr .9fr;gap:16px}.b2-section{background:#111419;border:1px solid #242831;border-radius:18px;padding:20px;margin-bottom:16px}.b2-section h2{font-size:17px;margin:0 0 5px}.b2-section>p{font-size:12px;color:#8f96a3;margin:0 0 16px}.b2-list{display:flex;flex-direction:column;gap:10px}.b2-row{display:grid;grid-template-columns:1fr auto;gap:14px;align-items:center;padding:11px 0;border-bottom:1px solid #20242b}.b2-row:last-child{border-bottom:0}.b2-row strong{font-size:13px}.b2-row small{display:block;color:#7f8794;margin-top:3px}.b2-pill{display:inline-flex;align-items:center;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:800;background:#1b2027;color:#aeb5c0}.b2-bar{height:7px;background:#22262e;border-radius:99px;overflow:hidden;margin-top:8px}.b2-bar i{display:block;height:100%;background:#f32d3a;border-radius:inherit}.b2-tools{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.b2-tool{background:#0d1014;border:1px solid #22262e;border-radius:14px;padding:15px}.b2-tool h3{font-size:14px;margin:0 0 6px}.b2-tool p{font-size:11px;color:#808896;line-height:1.45;margin:0 0 12px}.b2-input{width:100%;box-sizing:border-box;background:#090b0e;border:1px solid #30343d;color:#fff;border-radius:9px;padding:10px}.b2-btn{border:0;background:#f32d3a;color:#fff;border-radius:9px;padding:10px 12px;font-weight:800;cursor:pointer}.b2-result{margin-top:10px;padding:10px;border-radius:9px;background:#171b21;font-size:12px;line-height:1.45}.b2-empty{padding:22px;border:1px dashed #30343c;border-radius:12px;color:#818997;text-align:center;font-size:12px}.b2-nav{display:flex!important;align-items:center;gap:10px}.b2-nav-mark{width:20px;height:20px;border-radius:6px;background:#f32d3a;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:900}.b2-table{width:100%;border-collapse:collapse;font-size:12px}.b2-table th{text-align:left;color:#747c89;font-size:10px;text-transform:uppercase;letter-spacing:.08em;padding:8px;border-bottom:1px solid #292e36}.b2-table td{padding:10px 8px;border-bottom:1px solid #20242b}.b2-note{font-size:11px;color:#747c89;margin-top:10px}@media(max-width:1000px){.b2-grid{grid-template-columns:repeat(2,1fr)}.b2-sections{grid-template-columns:1fr}}@media(max-width:600px){.b2-panel{padding:18px 14px 40px}.b2-top h1{font-size:26px}.b2-grid{grid-template-columns:1fr}.b2-tools{grid-template-columns:1fr}.b2-top{align-items:center}}
  `;
  document.head.appendChild(style);
}

async function getData() {
  const config = await loadRuntimeConfig();
  if (!hasSupabaseConfig(config)) throw new Error("No hay configuración de datos disponible.");
  const client = await createSupabaseClient(config);
  const userResult = await client.auth.getUser();
  if (userResult.error || !userResult.data?.user) throw new Error("La sesión ha caducado. Vuelve a iniciar sesión.");
  const uid = userResult.data.user.id;
  const read = async (table) => {
    const result = await client.from(table).select("*").eq("user_id", uid).order("created_at", { ascending: true });
    if (result.error) throw result.error;
    return result.data || [];
  };
  const [transactions, accounts, assets, liabilities, goals, investments, snapshots] = await Promise.all([
    read("transactions"), read("accounts"), read("assets"), read("liabilities"), read("goals"), read("investments"), read("wealth_snapshots")
  ]);
  return { transactions, accounts, assets, liabilities, goals, investments, snapshots };
}

function txAmount(t) { return Number(t.amount || 0); }
function txMonth(t) { return String(t.date || "").slice(0, 7); }
function expenseTx(data) { return data.transactions.filter(t => ["expense", "fee"].includes(t.type)); }
function incomeTx(data) { return data.transactions.filter(t => ["income", "dividend"].includes(t.type)); }
function expensesIn(data, m) { return expenseTx(data).filter(t => txMonth(t) === m).reduce((s,t) => s + Math.abs(txAmount(t)), 0); }
function incomeIn(data, m) { return incomeTx(data).filter(t => txMonth(t) === m).reduce((s,t) => s + Math.abs(txAmount(t)), 0); }
function liquid(data) { return data.accounts.reduce((s,a) => s + Number(a.current_balance || 0), 0); }
function assetsTotal(data) { return data.assets.reduce((s,a) => s + Number(a.current_value || 0), 0); }
function liabilitiesTotal(data) { return data.liabilities.reduce((s,a) => s + Number(a.outstanding_balance || 0), 0); }
function netWorth(data) { return assetsTotal(data) + liquid(data) - liabilitiesTotal(data); }
function categories(data, m) {
  const map = {};
  expenseTx(data).filter(t => txMonth(t) === m).forEach(t => { const k=t.category_name || "Otros"; map[k]=(map[k]||0)+Math.abs(txAmount(t)); });
  return Object.entries(map).map(([name,value]) => ({name,value})).sort((a,b)=>b.value-a.value);
}
function recurring(data) {
  const groups = new Map();
  expenseTx(data).forEach(t => {
    const merchant = clean(t.merchant || t.description || "Movimiento");
    const amount = Math.round(Math.abs(txAmount(t))*100)/100;
    if (!merchant || !amount) return;
    const key = merchant + "|" + amount;
    const g=groups.get(key)||{merchant:t.merchant||t.description,amount,dates:[],category:t.category_name||"Otros"};
    g.dates.push(t.date); groups.set(key,g);
  });
  return [...groups.values()].filter(g => g.dates.length>=2).map(g => {
    const sorted=g.dates.map(d=>new Date(d)).sort((a,b)=>a-b); const gaps=[];
    for(let i=1;i<sorted.length;i++) gaps.push((sorted[i]-sorted[i-1])/86400000);
    const avg=gaps.reduce((a,b)=>a+b,0)/(gaps.length||1);
    return {...g,avgGap:avg,next:new Date(sorted.at(-1).getTime()+avg*86400000)};
  }).filter(g=>g.avgGap>=20&&g.avgGap<=40).sort((a,b)=>b.amount-a.amount);
}
function anomalies(data, m) {
  const byCat = new Map();
  expenseTx(data).forEach(t => { const k=clean(t.category_name||"Otros"); const arr=byCat.get(k)||[]; arr.push({date:t.date,amount:Math.abs(txAmount(t)),name:t.merchant||t.description||"Movimiento",category:t.category_name||"Otros"}); byCat.set(k,arr); });
  const out=[];
  byCat.forEach(arr=>{
    const historical=arr.filter(x=>txMonth({date:x.date})!==m).map(x=>x.amount); if(historical.length<3)return;
    const avg=historical.reduce((a,b)=>a+b,0)/historical.length; const recent=arr.filter(x=>txMonth({date:x.date})===m);
    recent.forEach(x=>{if(x.amount>Math.max(avg*2.2,avg+50))out.push({...x,avg});});
  });
  return out.sort((a,b)=>b.amount-a.amount).slice(0,6);
}
function duplicateCount(data) {
  const seen=new Set(), dup=[];
  data.transactions.forEach(t=>{const key=[t.date,t.account_legacy_id,t.type,t.amount,t.merchant,t.description].join("|");if(seen.has(key))dup.push(t);else seen.add(key);});
  return dup.length;
}
function health(data) {
  const m=month(); const inc=incomeIn(data,m), exp=expensesIn(data,m), rate=inc?Math.max(0,(inc-exp)/inc):0;
  const liq=liquid(data), monthly=Math.max(exp, data.transactions.length?expensesIn(data,txMonth(data.transactions.at(-1))):0), months=monthly?liq/monthly:0;
  const debtRatio=netWorth(data)>0?liabilitiesTotal(data)/netWorth(data):0;
  let score=50;
  score += Math.min(25,rate*100);
  score += Math.min(15,months*4);
  score -= Math.min(20,debtRatio*30);
  if(!data.transactions.length) score=0;
  return {score:Math.max(0,Math.min(100,Math.round(score))),rate,months,debtRatio,inc,exp};
}
function compare(data) {
  const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-1); const prev=month(d), cur=month();
  const a=expensesIn(data,prev),b=expensesIn(data,cur),ai=incomeIn(data,prev),bi=incomeIn(data,cur);
  return {prev,cur,expensePrev:a,expenseCur:b,incomePrev:ai,incomeCur:bi,expenseDelta:b-a,incomeDelta:bi-ai};
}
function budgetRows(data) {
  const cur=month(); const rows=categories(data,cur); return rows.slice(0,8).map(c=>{
    const history=[]; for(let i=1;i<=3;i++){const d=new Date();d.setDate(1);d.setMonth(d.getMonth()-i);history.push(categories(data,month(d)).find(x=>x.name===c.name)?.value||0);} const base=history.filter(Boolean); const avg=base.length?base.reduce((a,b)=>a+b,0)/base.length:c.value; const suggested=Math.max(10,Math.round(avg/10)*10); return {...c,suggested,ratio:suggested?c.value/suggested:0};
  });
}
function render(data) {
  const h=health(data), c=compare(data), rec=recurring(data), an=anomalies(data,month()), cats=categories(data,month()), budgets=budgetRows(data), dup=duplicateCount(data);
  const nw=netWorth(data), liq=liquid(data), debt=liabilitiesTotal(data), estAvailable=liq-rec.reduce((s,r)=>s+r.amount,0);
  const scoreClass=h.score>=75?"b2-good":h.score>=50?"b2-warn":"b2-bad";
  const topCats=cats.slice(0,5);
  return `<div class="b2-wrap">
    <div class="b2-top"><div><div class="b2-kicker">BorjaAI · Financial Intelligence</div><h1>Centro financiero 2.0</h1><p>Diagnóstico, control y decisiones basadas en tus datos reales.</p></div><button class="b2-close" data-b2-close>Cerrar</button></div>
    <div class="b2-grid">
      <div class="b2-card"><div class="b2-label">Salud financiera</div><div class="b2-value ${scoreClass}">${h.score}/100</div><div class="b2-sub">Ahorro ${percent(h.rate)} · liquidez ${h.months.toFixed(1)} meses</div></div>
      <div class="b2-card"><div class="b2-label">Patrimonio neto</div><div class="b2-value">${money(nw)}</div><div class="b2-sub">Activos ${money(assetsTotal(data))} · deuda ${money(debt)}</div></div>
      <div class="b2-card"><div class="b2-label">Liquidez</div><div class="b2-value">${money(liq)}</div><div class="b2-sub">Disponible estimado tras recurrentes: ${money(estAvailable)}</div></div>
      <div class="b2-card"><div class="b2-label">Este mes</div><div class="b2-value">${money(h.exp)}</div><div class="b2-sub">Ingresos ${money(h.inc)} · neto ${money(h.inc-h.exp)}</div></div>
    </div>
    <div class="b2-sections">
      <div>
        <section class="b2-section"><h2>Lectura de BorjaAI</h2><p>Las prioridades se generan desde los movimientos, liquidez, deuda y hábitos observados.</p><div class="b2-list">
          ${h.score===0?`<div class="b2-empty">Aún no hay suficientes datos para diagnosticar tu situación.</div>`:`<div class="b2-row"><div><strong>${h.rate>=.2?"Buen ritmo de ahorro":"El ahorro necesita atención"}</strong><small>Tasa de ahorro mensual: ${percent(h.rate)}</small></div><span class="b2-pill ${h.rate>=.2?"b2-good":"b2-warn"}">${h.rate>=.2?"BIEN":"REVISAR"}</span></div>`}
          <div class="b2-row"><div><strong>${h.months>=3?"Reserva razonable":"Reserva por debajo del objetivo"}</strong><small>${h.months.toFixed(1)} meses de gasto cubiertos con la liquidez actual.</small></div><span class="b2-pill">${h.months.toFixed(1)}x</span></div>
          <div class="b2-row"><div><strong>${debt===0?"Sin deuda registrada":"Peso de la deuda"}</strong><small>${debt===0?"No hay pasivos registrados.":"La deuda representa "+percent(h.debtRatio)+" del patrimonio neto."}</small></div><span class="b2-pill">${money(debt)}</span></div>
          ${an.length?`<div class="b2-row"><div><strong>Gasto inusual detectado</strong><small>${esc(an[0].name)} · ${money(an[0].amount)} frente a una media de ${money(an[0].avg)}.</small></div><span class="b2-pill b2-warn">ALERTA</span></div>`:""}
          ${dup?`<div class="b2-row"><div><strong>Posibles duplicados</strong><small>${dup} movimientos comparten fecha, cuenta, importe y concepto.</small></div><span class="b2-pill b2-bad">REVISAR</span></div>`:""}
        </div></section>
        <section class="b2-section"><h2>Gasto por categoría</h2><p>Septiembre · compara el consumo real con un presupuesto orientativo basado en tus últimos meses.</p><div class="b2-list">${topCats.length?topCats.map((x,i)=>{const b=budgets.find(z=>z.name===x.name);const ratio=b?.ratio||0;return `<div><div class="b2-row"><div><strong>${esc(x.name)}</strong><small>${money(x.value)} · referencia ${money(b?.suggested||0)}</small></div><span class="b2-pill ${ratio>1?"b2-bad":""}">${Math.round(ratio*100)}%</span></div><div class="b2-bar"><i style="width:${Math.min(100,Math.round(ratio*100))}%"></i></div></div>`}).join(""):`<div class="b2-empty">No hay gastos registrados este mes.</div>`}</div></section>
        <section class="b2-section"><h2>Comparativa mensual</h2><p>${esc(c.prev)} → ${esc(c.cur)}</p><table class="b2-table"><thead><tr><th></th><th>Anterior</th><th>Actual</th><th>Variación</th></tr></thead><tbody><tr><td>Gastos</td><td>${money(c.expensePrev)}</td><td>${money(c.expenseCur)}</td><td class="${c.expenseDelta>0?"b2-bad":"b2-good"}">${c.expenseDelta>=0?"+":""}${money(c.expenseDelta)}</td></tr><tr><td>Ingresos</td><td>${money(c.incomePrev)}</td><td>${money(c.incomeCur)}</td><td class="${c.incomeDelta>=0?"b2-good":"b2-bad"}">${c.incomeDelta>=0?"+":""}${money(c.incomeDelta)}</td></tr></tbody></table></section>
      </div>
      <div>
        <section class="b2-section"><h2>Herramientas</h2><p>Pequeñas decisiones, calculadas con tu situación actual.</p><div class="b2-tools">
          <div class="b2-tool"><h3>¿Me lo puedo permitir?</h3><p>Calcula el impacto de una compra sobre tu liquidez.</p><input class="b2-input" id="b2-afford" type="number" min="0" step="10" placeholder="Importe en €"><button class="b2-btn" style="margin-top:8px" data-b2-afford>Analizar</button><div class="b2-result" id="b2-afford-result">Introduce un importe.</div></div>
          <div class="b2-tool"><h3>Presupuesto sugerido</h3><p>Orientación automática a partir de tu media de los últimos 3 meses.</p><div class="b2-list">${budgets.slice(0,4).map(b=>`<div class="b2-row"><div><strong>${esc(b.name)}</strong><small>Real ${money(b.value)}</small></div><span class="b2-pill">${money(b.suggested)}</span></div>`).join("")||`<div class="b2-empty">Sin historial suficiente.</div>`}</div></div>
          <div class="b2-tool"><h3>Recurrentes</h3><p>Pagos mensuales detectados automáticamente.</p>${rec.length?`<div class="b2-list">${rec.slice(0,5).map(r=>`<div class="b2-row"><div><strong>${esc(r.merchant)}</strong><small>${esc(r.category)} · próximo aprox. ${r.next.toLocaleDateString("es-ES")}</small></div><span class="b2-pill">${money(r.amount)}</span></div>`).join("")}</div>`:`<div class="b2-empty">Aún no se detectan pagos mensuales repetidos.</div>`}</div>
          <div class="b2-tool"><h3>Anomalías</h3><p>Importes significativamente superiores a tu comportamiento histórico.</p>${an.length?`<div class="b2-list">${an.map(a=>`<div class="b2-row"><div><strong>${esc(a.name)}</strong><small>${esc(a.category)} · media ${money(a.avg)}</small></div><span class="b2-pill b2-warn">${money(a.amount)}</span></div>`).join("")}`:`<div class="b2-empty">No se han encontrado anomalías relevantes.</div>`}</div>
        </div></section>
        <section class="b2-section"><h2>Inversiones</h2><p>Lectura rápida de las posiciones registradas.</p>${data.investments.length?`<div class="b2-list">${data.investments.slice().sort((a,b)=>Number(b.current_value||0)-Number(a.current_value||0)).slice(0,8).map(i=>{const v=Number(i.current_value||0),cost=Number(i.cost_basis||0),r=cost?(v-cost)/cost:0;return `<div class="b2-row"><div><strong>${esc(i.name||i.ticker||"Inversión")}</strong><small>${esc(i.ticker||"")} · aportado ${money(cost)}</small></div><span class="b2-pill ${r>=0?"b2-good":"b2-bad"}">${percent(r)}</span></div>`}).join("")}</div>`:`<div class="b2-empty">No hay inversiones registradas.</div>`}</section>
        <section class="b2-section"><h2>Objetivos</h2><p>Progreso y distancia hasta tus metas.</p>${data.goals.length?`<div class="b2-list">${data.goals.map(g=>{const target=Number(g.target_amount||0),cur=Number(g.current_amount||0),r=target?cur/target:0;return `<div><div class="b2-row"><div><strong>${esc(g.name)}</strong><small>${money(cur)} de ${money(target)}${g.target_date?" · "+esc(g.target_date):""}</small></div><span class="b2-pill">${percent(r)}</span></div><div class="b2-bar"><i style="width:${Math.min(100,Math.round(r*100))}%"></i></div></div>`}).join("")}</div>`:`<div class="b2-empty">No hay objetivos configurados.</div>`}</section>
      </div>
    </div>
    <div class="b2-note">BorjaAI 2.0 · Las cifras son calculadas a partir de los datos almacenados en tu cuenta. Los presupuestos son orientativos y no modifican tus datos.</div>
  </div>`;
}

async function open() {
  injectStyle();
  let panel=document.getElementById(PANEL_ID);
  if(!panel){panel=document.createElement("div");panel.id=PANEL_ID;panel.className="b2-panel";document.body.appendChild(panel);}
  panel.innerHTML=`<div class="b2-wrap"><div class="b2-top"><div><div class="b2-kicker">BorjaAI · Financial Intelligence</div><h1>Centro financiero 2.0</h1><p>Analizando tus datos…</p></div><button class="b2-close" data-b2-close>Cerrar</button></div><div class="b2-empty">Cargando análisis financiero…</div></div>`;
  try { const data=await getData(); panel.innerHTML=render(data); bind(panel,data); } catch(e) { panel.innerHTML=`<div class="b2-wrap"><div class="b2-top"><div><div class="b2-kicker">BorjaAI · Financial Intelligence</div><h1>Centro financiero 2.0</h1></div><button class="b2-close" data-b2-close>Cerrar</button></div><div class="b2-empty">${esc(e.message||"No se pudo cargar el análisis.")}</div></div>`; }
}
function bind(panel,data){
  panel.querySelectorAll("[data-b2-close]").forEach(b=>b.addEventListener("click",()=>panel.remove()));
  const btn=panel.querySelector("[data-b2-afford]"); if(btn) btn.addEventListener("click",()=>{const amount=Number(panel.querySelector("#b2-afford")?.value||0), result=panel.querySelector("#b2-afford-result"),liq=liquid(data),rec=recurring(data).reduce((s,r)=>s+r.amount,0),available=liq-rec;if(!amount){result.textContent="Introduce un importe válido.";return;}const after=available-amount;const h=health(data);if(after<0)result.innerHTML=`<span class="b2-bad">🔴 No te lo recomiendo ahora.</span><br>El desembolso dejaría el disponible estimado en ${money(after)}.`;else if(after<Math.max(0,h.exp*1.5))result.innerHTML=`<span class="b2-warn">🟠 Podrías, pero con prudencia.</span><br>Después quedarían ${money(after)} de disponible estimado.`;else result.innerHTML=`<span class="b2-good">🟢 El impacto parece asumible.</span><br>Después quedarían ${money(after)} de disponible estimado.`;});
}
function addNav(){
  if(document.getElementById(NAV_ID)) return;
  const nav=document.querySelector(".side-nav"); if(!nav) return;
  const b=document.createElement("button"); b.type="button"; b.id=NAV_ID; b.className="nav-link b2-nav"; b.innerHTML='<span class="b2-nav-mark">2</span><span>BorjaAI 2.0</span>'; b.addEventListener("click",open); nav.appendChild(b);
}
function boot(){
  addNav();
  if(!document.getElementById(NAV_ID)) setTimeout(boot,500);
  window.addEventListener("keydown",e=>{if(e.key==="Escape")document.getElementById(PANEL_ID)?.remove();});
  new MutationObserver(addNav).observe(document.body,{childList:true,subtree:true});
}
boot();
