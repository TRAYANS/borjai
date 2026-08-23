import { createLocalStorageRepository } from "./src/storage.js";
import { CATEGORIES, parseCsv as parseCsvText, parseNumber } from "./src/importer.js";
import * as finance from "./src/finance.js";
import { buildLocalCoachAnswer } from "./src/coach.js";

const KEY = "borjai:mvp:v1";
const ICONS = {
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  arrows:'<path d="M17 3l4 4-4 4M3 7h18M7 21l-4-4 4-4M21 17H3"/>',
  receipt:'<path d="M5 3h14v18l-3-2-4 2-4-2-3 2zM8 8h8M8 12h8M8 16h5"/>',
  wallet:'<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2zM4 8h14v5H4M16 14h.01"/>',
  chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20V7M4 14l6-5 6 2 6-7"/>',
  target:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="m16 8 5-5"/>',
  sparkles:'<path d="m12 3-1.6 5.4L5 10l5.4 1.6L12 17l1.6-5.4L19 10l-5.4-1.6zM19 16l-.8 2.4L16 19l2.2.6L19 22l.8-2.4L22 19l-2.2-.6z"/>',
  upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 14v6a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-6"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.1 2.1-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-3v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-2.1-2.1.1-.1A1.7 1.7 0 0 0 7 15a1.7 1.7 0 0 0-1.5-1H5.3v-3h.2A1.7 1.7 0 0 0 7 10a1.7 1.7 0 0 0-.3-1.9l-.1-.1 2.1-2.1.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5v-.2h3v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 2.1 2.1-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2v3h-.2a1.7 1.7 0 0 0-1.5 1z"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  bell:'<path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 22h4"/>',
  trend:'<path d="m4 17 6-6 4 4 6-7M15 8h5v5"/>',
  alert:'<path d="m12 3 10 18H2zM12 9v4M12 17h.01"/>',
  close:'<path d="m6 6 12 12M18 6 6 18"/>',
  trash:'<path d="M4 7h16M10 11v6M14 11v6M9 7V4h6v3M6 7l1 14h10l1-14"/>',
  send:'<path d="m21 3-8 18-3-8-7-3zM10 13l4-4"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  refresh:'<path d="M20 11a8 8 0 1 0 1 4M20 4v7h-7"/>'
};

let currentView = "inicio";
let stagedImport = null;
let chat = [];
let filter = { search:"", type:"all" };
let repository = createLocalStorageRepository(KEY, seed);
let state = load();

function icon(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || ICONS.info) + '</svg>'; }
function hydrate(scope) { (scope || document).querySelectorAll("[data-icon]").forEach(function(n){ n.innerHTML = icon(n.dataset.icon); }); }
function uid(prefix) { return prefix + "-" + Math.random().toString(36).slice(2, 10); }
function iso(d) { return d.toISOString().slice(0, 10); }
function nowMonth() { return iso(new Date()).slice(0, 7); }
function sameMonth(offset, day) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()+offset); d.setDate(Math.min(day, new Date(d.getFullYear(),d.getMonth()+1,0).getDate())); return iso(d); }
function previousMonth() { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth()-1); return iso(d).slice(0,7); }
function money(n) { return new Intl.NumberFormat("es-ES",{style:"currency",currency:"EUR",maximumFractionDigits:0}).format(n).replace(/\s/g," "); }
function signed(n) { return (n>=0?"+":"-") + money(Math.abs(n)); }
function percent(n) { return new Intl.NumberFormat("es-ES",{style:"percent",maximumFractionDigits:1}).format(n); }
function date(n) { return new Intl.DateTimeFormat("es-ES",{day:"2-digit",month:"short"}).format(new Date(n+"T12:00:00")); }
function clean(n) { return String(n || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase(); }
function safe(n) { return String(n || "").replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c];}); }
function need(category) { return ["Vivienda","Alimentacion","Gasolina","Transporte","Salud","Seguros","Formacion"].includes(category); }
function labelMonth(value) { const parts=value.split("-").map(Number); return new Intl.DateTimeFormat("es-ES",{month:"long",year:"numeric"}).format(new Date(parts[0],parts[1]-1,1)); }

function seed() {
  const snapshotBase = [100200,101850,103100,105400,107900,109350,111900,113400,116800,119700,123450,126400];
  const snapshots = snapshotBase.map(function(value,index){ const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()-(11-index)); return {month:iso(d).slice(0,7),value:value}; });
  return {
    version:1,
    profile:{name:"Borja",risk:"Moderado",emergency:3,contribution:300,liveCoach:false},
    accounts:[
      {id:"santander",name:"Santander",kind:"bank",balance:14250},
      {id:"bbva",name:"BBVA",kind:"bank",balance:8600},
      {id:"revolut",name:"Revolut",kind:"bank",balance:5000},
      {id:"cash",name:"Efectivo",kind:"cash",balance:8190}
    ],
    assets:[
      {id:"etf",name:"ETF MSCI World",ticker:"IWDA",group:"Inversiones",type:"ETF",value:38000,cost:34600},
      {id:"stocks",name:"Acciones globales",ticker:"MIX",group:"Inversiones",type:"Acciones",value:12000,cost:11100},
      {id:"btc",name:"Bitcoin",ticker:"BTC",group:"Criptomonedas",type:"Cripto",value:18000,cost:18600},
      {id:"eth",name:"Ethereum",ticker:"ETH",group:"Criptomonedas",type:"Cripto",value:2300,cost:1980},
      {id:"gold",name:"Oro fisico",ticker:"XAU",group:"Oro y Metales",type:"Metal",value:10200,cost:9400},
      {id:"car",name:"Vehiculo",ticker:"",group:"Otros Activos",type:"Vehiculo",value:7000,cost:9000},
      {id:"other",name:"Otros activos",ticker:"",group:"Otros Activos",type:"Otros",value:5000,cost:5000}
    ],
    debts:[],
    transactions:[
      {id:"a1",date:sameMonth(0,2),merchant:"Nomina",description:"Nomina mensual",amount:2700,type:"income",category:"Ingresos",accountId:"santander"},
      {id:"a2",date:sameMonth(0,6),merchant:"Proyecto freelance",description:"Ingreso adicional",amount:310,type:"income",category:"Ingresos",accountId:"revolut"},
      {id:"a3",date:sameMonth(0,3),merchant:"Alquiler",description:"Vivienda",amount:-790,type:"expense",category:"Vivienda",accountId:"santander"},
      {id:"a4",date:sameMonth(0,5),merchant:"MERCADONA",description:"Compra semanal",amount:-304,type:"expense",category:"Alimentacion",accountId:"santander"},
      {id:"a5",date:sameMonth(0,7),merchant:"REPSOL",description:"Combustible",amount:-96,type:"expense",category:"Gasolina",accountId:"santander"},
      {id:"a6",date:sameMonth(0,9),merchant:"NETFLIX",description:"Suscripcion",amount:-17.99,type:"expense",category:"Suscripciones",accountId:"revolut"},
      {id:"a7",date:sameMonth(0,11),merchant:"UBER",description:"Trayecto",amount:-46.4,type:"expense",category:"Transporte",accountId:"revolut"},
      {id:"a8",date:sameMonth(0,14),merchant:"Restaurante",description:"Cena",amount:-132,type:"expense",category:"Restaurantes",accountId:"revolut"},
      {id:"a9",date:sameMonth(0,15),merchant:"Gimnasio",description:"Cuota mensual",amount:-45,type:"expense",category:"Salud",accountId:"santander"},
      {id:"a10",date:sameMonth(0,16),merchant:"AMAZON",description:"Compra online",amount:-91,type:"expense",category:"Compras",accountId:"santander"},
      {id:"a11",date:sameMonth(0,18),merchant:"MAPFRE",description:"Seguro",amount:-62,type:"expense",category:"Seguros",accountId:"santander"},
      {id:"a12",date:sameMonth(0,20),merchant:"Ocio",description:"Fin de semana",amount:-118,type:"expense",category:"Ocio",accountId:"revolut"},
      {id:"a13",date:sameMonth(0,21),merchant:"MyInvestor",description:"Aportacion ETF",amount:-300,type:"investment_buy",category:"Inversiones",accountId:"santander"},
      {id:"b1",date:sameMonth(-1,2),merchant:"Nomina",description:"Nomina mensual",amount:2700,type:"income",category:"Ingresos",accountId:"santander"},
      {id:"b2",date:sameMonth(-1,3),merchant:"Alquiler",description:"Vivienda",amount:-790,type:"expense",category:"Vivienda",accountId:"santander"},
      {id:"b3",date:sameMonth(-1,8),merchant:"MERCADONA",description:"Alimentacion",amount:-278,type:"expense",category:"Alimentacion",accountId:"santander"},
      {id:"b4",date:sameMonth(-1,16),merchant:"Ocio",description:"Ocio",amount:-80,type:"expense",category:"Ocio",accountId:"revolut"}
    ],
    goals:[
      {id:"g1",name:"Fondo de emergencia",target:9000,current:8190,date:sameMonth(8,1),priority:"Alta"},
      {id:"g2",name:"Viaje a Japon",target:3500,current:1450,date:sameMonth(10,15),priority:"Media"},
      {id:"g3",name:"Invertir este ano",target:5000,current:2700,date:sameMonth(4,28),priority:"Alta"}
    ],
    imports:[], snapshots:snapshots
  };
}
function load(){ return repository.load(); }
function save(){ repository.save(state); }

function account(id){ return finance.account(state,id); }
function accountName(id){ return account(id) ? account(id).name : "Sin cuenta"; }
function group(name){ return finance.group(state,name); }
function liquid(){ return finance.liquid(state); }
function debt(){ return finance.debt(state); }
function wealth(){ return finance.wealth(state); }
function monthItems(key){ return finance.monthItems(state,key); }
function metrics(key){ return finance.metrics(state,key); }
function allocations(){ return finance.allocations(state); }
function health(){ return finance.health(state,nowMonth(),{money:money,percent:percent}); }
function recommendation(){ return finance.recommendation(state,nowMonth(),{money:money,percent:percent}); }
function expenseCategories(){
  const map={}; monthItems(nowMonth()).filter(function(t){return t.type==="expense" || t.type==="fee";}).forEach(function(t){map[t.category]=(map[t.category]||0)+Math.abs(t.amount);});
  return Object.keys(map).map(function(k){return {name:k,value:map[k]};}).sort(function(a,b){return b.value-a.value;});
}
function alertList(){
  const m=metrics(nowMonth()), h=health(), category=expenseCategories(), out=[];
  const discretionary=category.filter(function(c){return !need(c.name);}).reduce(function(s,c){return s+c.value;},0);
  if(m.rate<.15) out.push({level:"warn",title:"Tasa de ahorro baja",text:"Estas ahorrando "+percent(m.rate)+" este mes; el objetivo es al menos 15%."});
  if(discretionary>m.expense*.28) out.push({level:"warn",title:"Gasto discrecional elevado",text:money(discretionary)+" corresponde a ocio, compras, viajes y restaurantes."});
  if(h.liquid<h.target) out.push({level:"danger",title:"Reserva incompleta",text:"La liquidez no alcanza el objetivo configurado."});
  if(group("Criptomonedas")/wealth()>.15) out.push({level:"warn",title:"Exposicion a cripto relevante",text:"Criptomonedas representa "+percent(group("Criptomonedas")/wealth())+" del patrimonio."});
  return out.length?out:[{level:"good",title:"Situacion estable",text:"No hay alertas relevantes que requieran accion hoy."}];
}
function snapshot(){ const key=nowMonth(), existing=state.snapshots.find(function(s){return s.month===key;}); if(existing) existing.value=wealth(); else state.snapshots.push({month:key,value:wealth()}); state.snapshots=state.snapshots.slice(-12); }
function dot(score){return score>=75?"good":score>=50?"warn":"danger";}
function typeName(t){return {income:"Ingreso",expense:"Gasto",investment_buy:"Inversion",investment_sell:"Venta",dividend:"Dividendo",fee:"Comision"}[t]||"Movimiento";}
function badge(t){const cls=t==="income"||t==="dividend"?"badge-income":t==="expense"||t==="fee"?"badge-expense":"badge-investment";return '<span class="badge '+cls+'">'+typeName(t)+'</span>';}
function head(kicker,title,copy,actions){return '<header class="view-head"><div><div class="section-kicker">'+kicker+'</div><h1>'+title+'</h1>'+(copy?'<p>'+copy+'</p>':"")+'</div>'+(actions?'<div class="view-head-actions">'+actions+'</div>':"")+'</header>';}
function ring(score){return '<div class="health-ring" style="--score:'+score+'"><div class="health-ring-content"><small>Salud<br>financiera</small><strong>'+score+'</strong><span>/100</span></div></div>';}
function metric(label,value,note,ico,tone){return '<article class="metric-panel"><div class="metric-panel-top"><span class="metric-label">'+label+'</span><span data-icon="'+ico+'"></span></div><strong class="metric-panel-value">'+value+'</strong><div class="metric-panel-note '+(tone||"")+'">'+note+'</div></article>';}
function coachVisual(className){return '<div class="'+className+'" aria-hidden="true"><span>B</span><i>AI</i></div>';}
function chart(){
  const values=state.snapshots.map(function(s){return s.value;}), max=Math.max.apply(null,values)*1.04, min=Math.min.apply(null,values)*.96, W=700,H=230,L=35,R=10,T=15,B=33;
  const p=values.map(function(v,i){return {x:L+(W-L-R)*i/(values.length-1),y:T+(H-T-B)*(1-(v-min)/(max-min))};});
  const line=p.map(function(a,i){return (i?"L":"M")+a.x.toFixed(1)+","+a.y.toFixed(1);}).join(" "), area=line+" L"+p[p.length-1].x+","+(H-B)+" L"+p[0].x+","+(H-B)+" Z";
  const grid=[0,.33,.66,1].map(function(n){const y=T+(H-T-B)*n;return '<line class="grid" x1="'+L+'" y1="'+y+'" x2="'+(W-R)+'" y2="'+y+'"/><text x="0" y="'+(y+4)+'">'+money(max-(max-min)*n)+'</text>';}).join("");
  const labels=[0,Math.floor((p.length-1)/2),p.length-1].map(function(i){return '<text x="'+p[i].x+'" y="'+(H-7)+'" text-anchor="middle">'+new Intl.DateTimeFormat("es-ES",{month:"short"}).format(new Date(state.snapshots[i].month+"-01T12:00:00")).replace(".","")+'</text>';}).join("");
  return '<svg class="line-chart" viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Evolucion del patrimonio"><defs><linearGradient id="wealth-area" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#f32d3a" stop-opacity=".32"/><stop offset="1" stop-color="#f32d3a" stop-opacity="0"/></linearGradient></defs>'+grid+'<path class="area" d="'+area+'"/><path class="line" d="'+line+'"/><circle class="dot" cx="'+p[p.length-1].x+'" cy="'+p[p.length-1].y+'" r="4.8"/>'+labels+'</svg>';
}
function miniChart(){
  const values=state.snapshots.slice(-8).map(function(s){return s.value;}), max=Math.max.apply(null,values),min=Math.min.apply(null,values);
  const p=values.map(function(v,i){return {x:i*100/(values.length-1),y:56-(v-min)/(max-min)*45};}), line=p.map(function(a,i){return (i?"L":"M")+a.x+","+a.y;}).join("");
  return '<svg class="wealth-mini-chart" viewBox="0 0 100 65" preserveAspectRatio="none"><defs><linearGradient id="mini-chart-fill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#f32d3a" stop-opacity=".32"/><stop offset="1" stop-color="#f32d3a" stop-opacity="0"/></linearGradient></defs><path class="chart-area" d="'+line+' L100,64 L0,64 Z"/><path class="chart-line" d="'+line+'"/></svg>';
}
function table(list,actions){
  if(!list.length) return '<div class="table-empty"><span data-icon="receipt"></span><p>No hay movimientos con este filtro.</p></div>';
  return '<div class="table-shell"><table class="data-table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Tipo</th><th>Categoria</th><th>Cuenta</th><th class="align-right">Importe</th>'+(actions?"<th></th>":"")+'</tr></thead><tbody>'+list.map(function(t){
    return '<tr><td>'+date(t.date)+'</td><td><strong>'+safe(t.merchant)+'</strong><br><span class="panel-note">'+safe(t.description||t.category)+'</span></td><td>'+badge(t.type)+'</td><td>'+safe(t.category)+'</td><td>'+accountName(t.accountId)+'</td><td class="align-right '+(t.amount>=0?"amount-positive":"amount-negative")+'">'+signed(t.amount)+'</td>'+(actions?'<td class="align-right"><button class="row-action" data-action="delete" data-id="'+t.id+'" aria-label="Eliminar"><span data-icon="trash"></span></button></td>':"")+'</tr>';
  }).join("")+'</tbody></table></div>';
}
function insight(m,h){
  const top=expenseCategories()[0], alerts=alertList().slice(0,2);
  return '<article class="insight-card"><div class="section-kicker">Lectura de este mes</div><h3>'+ (m.savings>=0?"Estas generando ahorro":"Hay que proteger el flujo mensual") +'</h3><p>'+ (top?"La mayor partida es "+top.name+" con "+money(top.value)+".":"Anade movimientos para encontrar patrones.") +'</p><ul class="insight-list"><li><i class="status-dot '+(h.liquid>=h.target?"":"warn")+'"></i>Liquidez: '+money(h.liquid)+'</li><li><i class="status-dot"></i>Salud financiera: '+h.score+"/100</li></ul></article><article class=\"insight-card\"><div class=\"section-kicker\">Alertas relevantes</div><h3>"+alerts[0].title+'</h3><ul class="insight-list">'+alerts.map(function(a){return '<li><i class="status-dot '+(a.level==="good"?"":a.level)+'"></i>'+a.text+'</li>';}).join("")+'</ul><button class="text-button" data-action="alerts">Ver analisis</button></article>';
}
function dashboard(){
  const m=metrics(nowMonth()), old=metrics(previousMonth()), h=health(), r=recommendation(), w=wealth(), prior=state.snapshots[state.snapshots.length-2].value, change=w-prior, allocation=allocations(), total=allocation.reduce(function(s,a){return s+a.value;},0);
  let acc=0, vars=allocation.map(function(a,i){acc+=a.value;return "--c"+(i+1)+":"+a.color+";--p"+(i+1)+":"+(acc/total*100).toFixed(2)+"%;";}).join("");
  const rows=allocation.map(function(a){return '<div class="allocation-row"><i style="--color:'+a.color+'"></i><span>'+a.name+'</span><strong>'+money(a.value)+' <span class="panel-note">'+percent(a.value/total)+'</span></strong></div>';}).join("");
  const quick=[["Donde invierto este mes?","inversion","trend"],["Como va mi patrimonio?","patrimonio","chart"],["Que gastos puedo recortar?","gastos","receipt"],["Riesgos detectados","riesgos","alert"]].map(function(q){return '<button class="quick-chip" data-action="ask" data-q="'+q[1]+'"><span data-icon="'+q[2]+'"></span>'+q[0]+'</button>';}).join("");
  return '<section class="view">'+head("Panel de control","Tu dinero, con contexto","Asi estas en "+labelMonth(nowMonth()),'<button class="btn" data-action="movement"><span data-icon="plus"></span>Registrar movimiento</button><button class="btn btn-primary" data-view="importar"><span data-icon="upload"></span>Anadir informacion</button>')+
    '<div class="dashboard-grid"><div class="hero-metrics"><section class="wealth-panel"><div class="metric-label">Patrimonio neto</div><div class="wealth-value">'+money(w)+'</div><div class="metric-delta '+(change<0?"is-down":"")+'"><strong>'+signed(change)+" ("+percent(change/prior)+')</strong><span>este mes</span></div><p class="metric-subline"><b>'+money(m.savings)+'</b> de ahorro, <b>'+money(m.invested)+'</b> aportados a cartera.</p>'+miniChart()+'</section><section class="health-panel">'+ring(h.score)+'<p class="health-caption">'+(h.score>=75?"Base financiera solida":"Hay palancas claras de mejora")+'</p></section></div>'+
    '<div class="dashboard-two"><section class="chart-panel"><div class="panel-head"><div><h2 class="panel-title">Evolucion del patrimonio</h2><span class="panel-note">Ultimos 12 meses</span></div><select class="period-select"><option>12 meses</option></select></div>'+chart()+'</section><section class="recommendation-panel"><div class="recommendation-top"><div class="recommendation-icon"><span data-icon="sparkles"></span></div><div><div class="section-kicker">Que haria hoy</div><h2>'+r.title+'</h2></div></div><p>'+r.text+'</p><div class="recommendation-facts"><div class="fact"><span>Propuesta</span><strong>'+r.main+'</strong></div><div class="fact"><span>Margen liquido</span><strong>'+r.detail+'</strong></div></div><div class="disclaimer">Analisis con tus datos locales. No incluye cotizaciones ni noticias en tiempo real.</div></section></div>'+
    '<section class="distribution-panel"><div class="panel-head"><div><h2 class="panel-title">Distribucion del patrimonio</h2><span class="panel-note">Activos menos deudas</span></div><button class="text-button" data-view="patrimonio">Ver patrimonio</button></div><div class="distribution-content"><div class="donut-wrap"><div class="donut" style="'+vars+'"></div><div class="donut-total"><strong>'+money(w)+'</strong><span>Total</span></div></div><div class="allocation-list">'+rows+'</div></div></section>'+
    '<div class="metric-grid">'+metric("Ingresos",money(m.income),"Este mes","upload","positive")+metric("Gastos",money(m.expense),(m.expense-old.expense>=0?"+":"")+percent((m.expense-old.expense)/(old.expense||1))+" frente al mes anterior","receipt",m.expense>old.expense?"negative":"")+metric("Ahorro",money(m.savings),percent(m.rate)+" de tus ingresos","wallet",m.savings>=0?"positive":"negative")+metric("Inversion",money(m.invested),"No se contabiliza como gasto","chart","")+'</div>'+
    '<section class="panel coach-strip"><div class="coach-strip-copy"><div class="section-kicker">Coach Financiero <span class="badge badge-investment">IA local</span></div><h2>Un resumen que te ayuda a decidir</h2><p>'+r.main+". "+r.text+'</p><div class="coach-actions">'+quick+'</div></div>'+coachVisual("coach-art coach-fallback")+'</section>'+
    '<div class="content-grid"><section class="table-shell"><div class="table-toolbar"><div><h2 class="panel-title">Ultimos movimientos</h2><span class="panel-note">Tu fuente de verdad financiera</span></div><button class="btn btn-small" data-view="movimientos">Ver todos</button></div>'+table(state.transactions.slice().sort(function(a,b){return b.date.localeCompare(a.date);}).slice(0,5),false)+'</section><aside class="side-stack">'+insight(m,h)+'</aside></div></div></section>';
}
function movements(){
  const m=metrics(nowMonth()), list=state.transactions.filter(function(t){return (filter.type==="all"||t.type===filter.type) && (!filter.search||clean(t.merchant+" "+t.description+" "+t.category).includes(clean(filter.search)));}).sort(function(a,b){return b.date.localeCompare(a.date);});
  return '<section class="view">'+head("Registro financiero","Movimientos","Anade, revisa y clasifica cada entrada. Invertir no se contabiliza como gasto.",'<button class="btn" data-view="importar"><span data-icon="upload"></span>Importar archivo</button><button class="btn btn-primary" data-action="movement"><span data-icon="plus"></span>Nuevo movimiento</button>')+
  '<div class="summary-row"><article class="summary-stat"><span>Ingresos del mes</span><strong>'+money(m.income)+'</strong><small>Dinero que entra</small></article><article class="summary-stat"><span>Gastos del mes</span><strong>'+money(m.expense)+'</strong><small>Consumo y recibos</small></article><article class="summary-stat"><span>Ahorro generado</span><strong>'+money(m.savings)+'</strong><small>'+percent(m.rate)+' de tasa de ahorro</small></article><article class="summary-stat"><span>Aportado a cartera</span><strong>'+money(m.invested)+'</strong><small>Movimiento entre activos</small></article></div>'+
  '<section class="table-shell" style="margin-top:18px"><div class="table-toolbar"><div class="toolbar-filters"><input class="search-field" id="search" placeholder="Buscar concepto" value="'+safe(filter.search)+'"><select class="filter-select" id="type-filter"><option value="all">Todos los tipos</option><option value="income"'+(filter.type==="income"?" selected":"")+'>Ingresos</option><option value="expense"'+(filter.type==="expense"?" selected":"")+'>Gastos</option><option value="investment_buy"'+(filter.type==="investment_buy"?" selected":"")+'>Inversiones</option></select></div><span class="panel-note">'+list.length+' movimientos</span></div>'+table(list,true)+'</section></section>';
}
function bars(items){
  if(!items.length) return '<div class="table-empty">Aun no hay gastos este mes.</div>';
  return '<div class="bar-chart">'+items.map(function(i){return '<div class="bar-row"><span class="bar-row-label">'+i.name+'</span><div class="bar-track"><div class="bar-fill" style="width:'+(i.value/items[0].value*100)+'%"></div></div><strong>'+money(i.value)+'</strong></div>';}).join("")+'</div>';
}
function expenses(){
  const m=metrics(nowMonth()), items=expenseCategories(), necessary=items.filter(function(i){return need(i.name);}).reduce(function(s,i){return s+i.value;},0), discretionary=m.expense-necessary, top=items[0];
  return '<section class="view">'+head("Analisis de consumo","Gastos","Entiende a donde se va tu dinero y que cambios tendrian mas impacto.",'<button class="btn btn-primary" data-action="movement"><span data-icon="plus"></span>Registrar gasto</button>')+
  '<div class="summary-row"><article class="summary-stat"><span>Gastos totales</span><strong>'+money(m.expense)+'</strong><small>'+percent(m.income?m.expense/m.income:0)+' de ingresos</small></article><article class="summary-stat"><span>Necesarios</span><strong>'+money(necessary)+'</strong><small>Vivienda y servicios</small></article><article class="summary-stat"><span>Discrecionales</span><strong>'+money(discretionary)+'</strong><small>Ocio, compras y restaurantes</small></article><article class="summary-stat"><span>Categoria principal</span><strong>'+ (top?top.name:"-") +'</strong><small>'+ (top?money(top.value):"Sin datos") +'</small></article></div>'+
  '<div class="gastos-layout" style="margin-top:18px"><section class="category-card panel"><div class="panel-head"><div><h2 class="panel-title">Gasto por categoria</h2><span class="panel-note">'+labelMonth(nowMonth())+'</span></div></div>'+bars(items)+'</section><aside class="recurring-card panel"><div><div class="section-kicker">Lectura de BorjaAI</div><h2 class="panel-title" style="margin-top:5px">Donde actuaria primero</h2></div><p class="panel-note">'+(top?"La categoria "+top.name+" concentra "+percent(top.value/m.expense)+" del gasto. Un ajuste de 10% liberaria "+money(top.value*.1)+".":"Anade movimientos para generar recomendaciones.")+'</p><div class="recurring-row"><span>Suscripciones</span><strong>'+money((items.find(function(i){return i.name==="Suscripciones";})||{value:0}).value)+'</strong></div><div class="recurring-row"><span>Restaurantes y ocio</span><strong>'+money(items.filter(function(i){return i.name==="Restaurantes"||i.name==="Ocio";}).reduce(function(s,i){return s+i.value;},0))+'</strong></div><button class="btn btn-small" data-action="ask" data-q="gastos">Pedir analisis</button></aside></div>'+
  '<section class="table-shell" style="margin-top:18px"><div class="table-toolbar"><div><h2 class="panel-title">Gastos recientes</h2><span class="panel-note">Clasificacion editable por ti</span></div><button class="btn btn-small" data-view="movimientos">Abrir movimientos</button></div>'+table(monthItems(nowMonth()).filter(function(t){return t.type==="expense";}).sort(function(a,b){return b.date.localeCompare(a.date);}),true)+'</section></section>';
}
function patrimonio(){
  const h=health(), items=allocations(), total=items.reduce(function(s,i){return s+i.value;},0);
  return '<section class="view">'+head("Balance personal","Patrimonio","Activos menos deudas. Cada registro conserva su cuenta o tipo de activo.",'<button class="btn btn-primary" data-action="account"><span data-icon="plus"></span>Anadir cuenta</button>')+
  '<div class="breakdown-grid"><section class="breakdown-panel panel"><div class="section-kicker">Patrimonio neto</div><div class="wealth-value" style="font-size:45px">'+money(wealth())+'</div><p class="metric-subline">Liquidez disponible <b>'+money(h.liquid)+'</b>. Reserva objetivo <b>'+money(h.target)+'</b>.</p><div class="allocation-bars" style="margin-top:23px">'+items.map(function(i){return '<div class="allocation-bar"><span>'+i.name+'</span><div class="bar-track"><div class="bar-fill" style="--allocation-color:'+i.color+';width:'+(i.value/total*100)+'%"></div></div><strong>'+percent(i.value/total)+'</strong></div>';}).join("")+'</div></section><section class="breakdown-panel panel"><div class="panel-head"><div><h2 class="panel-title">Cuentas y efectivo</h2><span class="panel-note">Saldo actual registrado</span></div></div><div class="account-list">'+state.accounts.map(function(a){return '<div class="account-row"><div class="account-name"><i class="account-mark">'+safe(a.name.slice(0,1))+'</i><span>'+safe(a.name)+'<small class="account-meta">'+(a.kind==="cash"?"Efectivo":a.kind==="broker"?"Broker":"Cuenta bancaria")+'</small></span></div><strong>'+money(a.balance)+'</strong></div>';}).join("")+'</div></section></div>'+
  '<div class="content-grid" style="margin-top:18px"><section class="breakdown-panel panel"><div class="panel-head"><div><h2 class="panel-title">Activos no liquidos</h2><span class="panel-note">Valoracion manual o de mercado</span></div><button class="btn btn-small" data-view="inversiones">Ver cartera</button></div><div class="holding-list">'+state.assets.map(function(a){const p=a.value-a.cost;return '<div class="holding-row"><div class="holding-name"><span>'+safe(a.name)+'<small class="holding-meta">'+a.group+(a.ticker?" · "+a.ticker:"")+'</small></span></div><div><strong>'+money(a.value)+'</strong><span class="holding-profit '+(p<0?"negative":"")+'">'+signed(p)+'</span></div></div>';}).join("")+'</div></section><aside class="side-stack"><article class="insight-card"><div class="section-kicker">Formula</div><h3>Activos - deudas</h3><p>Actualmente hay '+money(debt())+' de deudas registradas.</p></article><article class="insight-card"><div class="section-kicker">Futuro</div><h3>Vivienda preparada</h3><p>El modelo admite inmuebles e hipotecas sin mezclar valor de vivienda con efectivo.</p></article></aside></div></section>';
}
function investments(){
  const list=state.assets.filter(function(a){return ["Inversiones","Criptomonedas","Oro y Metales"].includes(a.group);}), total=list.reduce(function(s,a){return s+a.value;},0);
  const groups=[{name:"Inversiones",color:"#f32d3a"},{name:"Criptomonedas",color:"#9d5ce5"},{name:"Oro y Metales",color:"#e2b450"}].map(function(g){return {name:g.name,value:group(g.name),color:g.color};}).filter(function(g){return g.value;});
  return '<section class="view">'+head("Cartera","Inversiones","Concentracion, rentabilidad y aportaciones en un solo sitio.",'<button class="btn btn-primary" data-action="movement" data-invest="true"><span data-icon="plus"></span>Registrar aportacion</button>')+
  '<div class="breakdown-grid"><section class="breakdown-panel panel"><div class="section-kicker">Valor invertido</div><div class="portfolio-head"><div class="portfolio-total"><strong>'+money(total)+'</strong><span>'+percent(total/wealth())+' del patrimonio</span></div><span class="badge badge-investment">'+state.profile.risk+'</span></div><div class="allocation-bars">'+groups.map(function(g){return '<div class="allocation-bar"><span>'+g.name+'</span><div class="bar-track"><div class="bar-fill" style="--allocation-color:'+g.color+';width:'+(g.value/total*100)+'%"></div></div><strong>'+percent(g.value/total)+'</strong></div>';}).join("")+'</div></section><section class="breakdown-panel panel"><div class="section-kicker">Lectura de riesgo</div><h2 class="panel-title" style="margin-top:5px">'+(group("Criptomonedas")/wealth()>.15?"Cripto ya tiene peso material":"La cartera esta razonablemente repartida")+'</h2><p class="panel-note" style="margin:9px 0 0">'+(group("Criptomonedas")/wealth()>.15?"Antes de aumentar cripto, priorizaria nuevas aportaciones a la parte diversificada.":"La siguiente aportacion puede reforzar la diversificacion sin comprometer la reserva.")+'</p><button class="btn btn-small" style="margin-top:18px" data-action="ask" data-q="inversion">Analizar cartera</button></section></div>'+
  '<section class="table-shell" style="margin-top:18px"><div class="table-toolbar"><div><h2 class="panel-title">Posiciones</h2><span class="panel-note">Valor actual frente al coste registrado</span></div></div><table class="data-table"><thead><tr><th>Activo</th><th>Tipo</th><th>Valor actual</th><th class="align-right">Rentabilidad</th></tr></thead><tbody>'+list.map(function(a){const p=a.value-a.cost;return '<tr><td><strong>'+safe(a.name)+'</strong><br><span class="panel-note">'+(a.ticker||"Sin ticker")+'</span></td><td><span class="badge badge-investment">'+a.type+'</span></td><td><strong>'+money(a.value)+'</strong></td><td class="align-right '+(p>=0?"amount-positive":"amount-negative")+'">'+signed(p)+'<br><span class="panel-note">'+percent(p/a.cost)+'</span></td></tr>';}).join("")+'</tbody></table></section><p class="disclaimer">Las valoraciones son datos registrados por el usuario. Esta version no consulta mercado en tiempo real ni ofrece garantias.</p></section>';
}
function goals(){
  return '<section class="view">'+head("Plan financiero","Objetivos","Convierte el ahorro en prioridades concretas y medibles.",'<button class="btn btn-primary" data-action="goal"><span data-icon="plus"></span>Crear objetivo</button>')+
  '<div class="goals-grid">'+state.goals.map(function(g){const p=Math.min(g.current/g.target,1);return '<button class="goal-card" data-action="goal" data-id="'+g.id+'"><div class="goal-card-head"><span class="badge badge-investment">'+safe(g.priority)+'</span><span data-icon="target"></span></div><h3>'+safe(g.name)+'</h3><p>Objetivo para '+date(g.date)+'</p><div class="progress-track"><div class="progress-value" style="width:'+(p*100)+'%"></div></div><div class="goal-card-footer"><span>'+money(g.current)+' de '+money(g.target)+'</span><strong>'+Math.round(p*100)+'%</strong></div><p style="margin-top:12px">Faltan '+money(Math.max(0,g.target-g.current))+'</p></button>';}).join("")+'</div><section class="panel insight-card" style="margin-top:18px"><div class="section-kicker">Proyeccion orientativa</div><h3>Con '+money(metrics(nowMonth()).savings)+' de ahorro mensual</h3><p>El simulador de la siguiente fase incorporara aportaciones, fecha, prioridad y escenarios separados de las predicciones.</p></section></section>';
}
function healthView(){
  const h=health(); return '<section class="view">'+head("Diagnostico","Como estas","La puntuacion usa reglas visibles sobre ahorro, liquidez, riesgo y objetivos.")+'<div class="health-layout"><section class="health-summary panel">'+ring(h.score)+'<p class="health-caption">'+(h.score>=80?"La situacion mejora. Vigila gasto discrecional antes de elevar riesgo.":"Hay margen para mejorar la base: ahorro, liquidez y gasto.")+'</p></section><section class="panel" style="padding:18px"><div class="panel-head"><div><h2 class="panel-title">Componentes de la puntuacion</h2><span class="panel-note">Cada punto es explicable</span></div></div><div class="health-list">'+h.parts.map(function(p){return '<div class="health-row"><i class="status-dot '+dot(p.score)+'"></i><span>'+p.label+'</span><strong>'+Math.round(p.score)+'/100</strong><small>'+p.note+'</small></div>';}).join("")+'</div></section></div></section>';
}
function coachContext(){
  const h=health(),m=h.metrics;
  return {
    currency:"EUR",
    patrimonio_neto:Math.round(wealth()),
    liquidez:Math.round(h.liquid),
    reserva_objetivo:Math.round(h.target),
    salud_financiera:h.score,
    ingresos_mes:Math.round(m.income),
    gastos_mes:Math.round(m.expense),
    ahorro_mes:Math.round(m.savings),
    tasa_ahorro:Math.round(m.rate*1000)/10,
    aportaciones_mes:Math.round(m.invested),
    distribucion:allocations().map(function(a){return {activo:a.name,valor:Math.round(a.value),porcentaje:Math.round(a.value/wealth()*1000)/10};}),
    objetivos:state.goals.map(function(g){return {nombre:g.name,actual:Math.round(g.current),objetivo:Math.round(g.target),fecha:g.date};}),
    alertas:alertList().filter(function(a){return a.level!=="good";}).map(function(a){return a.title;})
  };
}
function answer(q){
  return buildLocalCoachAnswer(q,{
    metrics:metrics(nowMonth()),
    health:health(),
    topExpense:expenseCategories()[0],
    recommendation:recommendation(),
    invested:group("Inversiones")+group("Criptomonedas")+group("Oro y Metales"),
    wealth:wealth(),
    goals:state.goals,
    alerts:alertList()
  },{money:money});
}
function coach(){
  const h=health(),r=recommendation(), messages=chat.length?chat:[{role:"assistant",text:"Hola, Borja. He revisado tus registros: patrimonio de "+money(wealth())+", ahorro de "+money(h.metrics.savings)+" y salud "+h.score+"/100. ¿Que quieres analizar?"}];
  const rendered=messages.map(function(m){return '<div class="chat-message '+(m.role==="user"?"user":"")+'">'+(m.role==="assistant"?coachVisual("chat-avatar coach-avatar-fallback"):"")+'<div class="chat-bubble">'+safe(m.text)+'</div></div>';}).join("");
  const quick=["Donde invierto este mes?","Que gastos puedo recortar?","Como va mi patrimonio?","Estoy diversificado?"].map(function(q){return '<button class="quick-chip" data-action="ask" data-q="'+q+'">'+q+'</button>';}).join("");
  return '<section class="view">'+head("Analisis conversacional","Coach Financiero","Respuestas basadas en tus registros. No sustituye asesoramiento financiero profesional.")+'<div class="coach-view"><section class="chat-panel panel"><div class="chat-messages" id="messages">'+rendered+'</div><div class="chat-suggestions">'+quick+'</div><form class="chat-input-row" id="chat-form"><input name="question" placeholder="Pregunta por tu dinero..." autocomplete="off"><button class="btn btn-primary chat-send" aria-label="Enviar"><span data-icon="send"></span></button></form></section><aside class="coach-context panel">'+coachVisual("coach-avatar-large coach-fallback-large")+'<h2>Contexto actual</h2><p>El Coach lee tus datos estructurados; no inventa movimientos.</p><div class="context-fact"><span>Patrimonio</span><strong>'+money(wealth())+'</strong></div><div class="context-fact"><span>Ahorro del mes</span><strong>'+money(h.metrics.savings)+'</strong></div><div class="context-fact"><span>Reserva objetivo</span><strong>'+money(h.target)+'</strong></div><div class="context-fact"><span>Que haria hoy</span><strong>'+r.main+'</strong></div></aside></div></section>';
}
function imports(){
  const history=state.imports.length?state.imports.slice().reverse().map(function(i){return '<div class="history-row"><div><strong>'+safe(i.fileName)+'</strong><span>'+date(i.createdAt)+" · "+i.count+" movimientos confirmados</span></div><button class=\"btn btn-small btn-danger\" data-action=\"undo\" data-id=\""+i.id+"\">Deshacer</button></div>";}).join(""):'<div class="empty-state"><span data-icon="upload"></span><p>Aun no has confirmado ninguna importacion.</p></div>';
  return '<section class="view">'+head("Entrada de datos","Importar informacion","El archivo se revisa antes de tocar tus datos financieros.",'<button class="btn" data-action="movement"><span data-icon="plus"></span>Entrada manual</button>')+
  '<div class="import-layout"><label class="drop-zone" id="drop-zone"><input id="file-input" type="file" accept=".csv,.xlsx,.xls,.pdf,.jpg,.jpeg,.png" multiple><div class="drop-zone-icon"><span data-icon="upload"></span></div><h2>Arrastra un archivo aqui</h2><p>Extractos, movimientos, informes o capturas. CSV se analiza localmente; los demas formatos pasan al importador seguro al conectar el backend.</p><small>PDF, CSV, XLSX, JPG, JPEG y PNG</small></label><aside class="import-info panel"><div class="section-kicker">Flujo protegido</div><h2>Nada se incorpora sin tu visto bueno</h2><p>La importacion crea una propuesta editable. Solo al confirmar se guardan movimientos.</p><div class="flow-steps"><div class="flow-step"><i class="flow-number">1</i><div><strong>Archivo</strong>Seleccionas la fuente.</div></div><div class="flow-step"><i class="flow-number">2</i><div><strong>Extraccion</strong>Se obtienen candidatos estructurados.</div></div><div class="flow-step"><i class="flow-number">3</i><div><strong>Revision</strong>Corriges fecha, concepto, importe o categoria.</div></div><div class="flow-step"><i class="flow-number">4</i><div><strong>Confirmacion</strong>Se registra el lote y se puede deshacer.</div></div></div></aside></div><section class="import-history panel"><h2>Historial de importaciones</h2>'+history+'</section></section>';
}

function render(){
  const map={inicio:dashboard,movimientos:movements,gastos:expenses,patrimonio:patrimonio,inversiones:investments,objetivos:goals,coach:coach,importar:imports,salud:healthView};
  document.getElementById("app-view").innerHTML=(map[currentView]||dashboard)(); hydrate(document.getElementById("app-view")); nav(); topbar(); dropZone();
}
function nav(){
  document.querySelectorAll("[data-view]").forEach(function(n){n.classList.toggle("is-active",n.dataset.view===currentView);});
}
function topbar(){
  const names={inicio:"Buenos dias, "+state.profile.name,movimientos:"Registro de movimientos",gastos:"Analisis de gastos",patrimonio:"Balance patrimonial",inversiones:"Tu cartera",objetivos:"Tus objetivos",coach:"Coach Financiero",importar:"Importar informacion",salud:"Salud financiera"};
  document.getElementById("topbar-title").textContent=names[currentView]||"BorjaAI";
  const alert=alertList().filter(function(a){return a.level!=="good";}), badge=document.getElementById("alert-count"); badge.textContent=alert.length; badge.dataset.zero=String(!alert.length);
}
function go(view){ currentView=view; document.querySelector(".app-shell").classList.remove("menu-open"); render(); window.scrollTo({top:0,behavior:"smooth"}); }
function modal(content,wide){const root=document.getElementById("modal-root");root.innerHTML='<div class="modal-backdrop" data-action="close-modal"><section class="modal '+(wide?"modal-wide":"")+'" role="dialog" aria-modal="true" data-modal-content="true">'+content+'</section></div>';hydrate(root);const f=root.querySelector("input,select,textarea,button");if(f)f.focus();}
function close(){document.getElementById("modal-root").innerHTML="";}
function toast(text,error){const r=document.getElementById("toast-root"),n=document.createElement("div");n.className="toast"+(error?" error":"");n.innerHTML='<span data-icon="'+(error?"alert":"check")+'"></span><span>'+safe(text)+'</span>';r.appendChild(n);hydrate(n);setTimeout(function(){n.remove();},3600);}
function movementModal(invest){
  const accounts=state.accounts.map(function(a){return '<option value="'+a.id+'">'+safe(a.name)+'</option>';}).join(""), cats=CATEGORIES.map(function(c){return '<option value="'+c+'">'+c+'</option>';}).join("");
  modal('<header class="modal-head"><div><div class="section-kicker">Registro manual</div><h2>Nuevo movimiento</h2><p>Ingresos, gastos e inversiones se tratan de forma distinta.</p></div><button class="icon-button modal-close" data-action="close-modal"><span data-icon="close"></span></button></header><form id="movement-form"><div class="modal-body"><div class="form-grid"><div class="form-field full"><label>Concepto</label><input name="merchant" required placeholder="Ej. MERCADONA o Nomina"></div><div class="form-field"><label>Tipo</label><select name="type"><option value="income">Ingreso</option><option value="expense">Gasto</option><option value="investment_buy"'+(invest?" selected":"")+'>Aportacion a inversion</option><option value="investment_sell">Venta de inversion</option></select></div><div class="form-field"><label>Importe</label><input name="amount" type="number" min=".01" step=".01" required></div><div class="form-field"><label>Fecha</label><input name="date" type="date" value="'+iso(new Date())+'" required></div><div class="form-field"><label>Cuenta</label><select name="accountId">'+accounts+'</select></div><div class="form-field"><label>Categoria</label><select name="category">'+cats+'</select></div><div class="form-field full"><label>Nota opcional</label><textarea name="description"></textarea></div></div><p class="form-hint">Una aportacion mueve dinero de liquidez a cartera: no reduce ahorro ni se marca como gasto.</p></div><footer class="modal-foot"><button type="button" class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary">Guardar movimiento</button></footer></form>');
}
function goalModal(id){
  const g=state.goals.find(function(x){return x.id===id;});
  modal('<header class="modal-head"><div><div class="section-kicker">Plan financiero</div><h2>'+ (g?"Editar objetivo":"Nuevo objetivo") +'</h2><p>Define importe, fecha y avance actual.</p></div><button class="icon-button modal-close" data-action="close-modal"><span data-icon="close"></span></button></header><form id="goal-form" data-id="'+(g?g.id:"")+'"><div class="modal-body"><div class="form-grid"><div class="form-field full"><label>Nombre</label><input name="name" required value="'+safe(g?g.name:"")+'"></div><div class="form-field"><label>Importe objetivo</label><input name="target" type="number" min="1" required value="'+(g?g.target:"")+'"></div><div class="form-field"><label>Importe actual</label><input name="current" type="number" min="0" required value="'+(g?g.current:0)+'"></div><div class="form-field"><label>Fecha</label><input name="date" type="date" required value="'+(g?g.date:iso(new Date()))+'"></div><div class="form-field"><label>Prioridad</label><select name="priority"><option'+(g&&g.priority==="Alta"?" selected":"")+'>Alta</option><option'+(g&&g.priority==="Media"?" selected":"")+'>Media</option><option'+(g&&g.priority==="Baja"?" selected":"")+'>Baja</option></select></div></div></div><footer class="modal-foot"><button type="button" class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary">Guardar objetivo</button></footer></form>');
}
function accountModal(){modal('<header class="modal-head"><div><div class="section-kicker">Patrimonio</div><h2>Anadir cuenta o efectivo</h2><p>El saldo entra en la parte liquida del patrimonio.</p></div><button class="icon-button modal-close" data-action="close-modal"><span data-icon="close"></span></button></header><form id="account-form"><div class="modal-body"><div class="form-grid"><div class="form-field"><label>Nombre</label><input name="name" required></div><div class="form-field"><label>Tipo</label><select name="kind"><option value="bank">Cuenta bancaria</option><option value="cash">Efectivo</option><option value="broker">Broker</option></select></div><div class="form-field full"><label>Saldo actual</label><input name="balance" type="number" min="0" step=".01" required></div></div></div><footer class="modal-foot"><button type="button" class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary">Anadir cuenta</button></footer></form>');}
function settings(){
  modal('<header class="modal-head"><div><div class="section-kicker">Configuracion</div><h2>Preferencias financieras</h2><p>Estas reglas alimentan la lectura local del Coach.</p></div><button class="icon-button modal-close" data-action="close-modal"><span data-icon="close"></span></button></header><form id="settings-form"><div class="modal-body"><div class="form-grid"><div class="form-field"><label>Tu nombre</label><input name="name" required value="'+safe(state.profile.name)+'"></div><div class="form-field"><label>Perfil de riesgo</label><select name="risk"><option'+(state.profile.risk==="Conservador"?" selected":"")+'>Conservador</option><option'+(state.profile.risk==="Moderado"?" selected":"")+'>Moderado</option><option'+(state.profile.risk==="Dinamico"?" selected":"")+'>Dinamico</option></select></div><div class="form-field"><label>Meses de emergencia</label><input name="emergency" type="number" min="1" max="12" required value="'+state.profile.emergency+'"></div><div class="form-field"><label>Aportacion mensual</label><input name="contribution" type="number" min="0" step="10" required value="'+state.profile.contribution+'"></div></div><button class="btn btn-small btn-danger" style="margin-top:20px" type="button" data-action="reset"><span data-icon="refresh"></span>Restablecer datos de ejemplo</button></div><footer class="modal-foot"><button type="button" class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary">Guardar cambios</button></footer></form>');
}
function alertsModal(){const list=alertList();modal('<header class="modal-head"><div><div class="section-kicker">Alertas inteligentes</div><h2>Solo lo que requiere atencion</h2><p>Cada aviso esta vinculado a tus datos.</p></div><button class="icon-button modal-close" data-action="close-modal"><span data-icon="close"></span></button></header><div class="modal-body"><div class="insight-list">'+list.map(function(a){return '<div class="health-row"><i class="status-dot '+(a.level==="good"?"":a.level)+'"></i><span>'+a.title+'</span><strong>'+ (a.level==="good"?"Estable":"Revisar") +'</strong><small>'+a.text+'</small></div>';}).join("")+'</div></div><footer class="modal-foot"><button class="btn btn-primary" data-action="close-modal">Entendido</button></footer>');}
function parseCsv(text,file){ return parseCsvText(text,file,state.accounts[0].id); }
async function upload(files){
  const list=Array.from(files||[]),csvs=list.filter(function(f){return f.name.toLowerCase().endsWith(".csv")||f.type==="text/csv";}),other=list.filter(function(f){return !csvs.includes(f);});
  if(csvs.length){try{let candidates=[];for(const f of csvs)candidates=candidates.concat(parseCsv(await f.text(),f.name));if(!candidates.length)throw new Error("No he encontrado importes validos.");stagedImport={id:uid("import"),fileName:csvs.map(function(f){return f.name;}).join(", "),createdAt:iso(new Date()),candidates:candidates};review();return;}catch(e){toast(e.message||"No se pudo analizar el CSV.",true);}}
  if(other.length) unsupported(other);
}
function review(){
  const rows=stagedImport.candidates.map(function(c,i){return '<tr><td><input type="date" data-review="'+i+'" data-field="date" value="'+c.date+'"></td><td><input data-review="'+i+'" data-field="merchant" value="'+safe(c.merchant)+'"></td><td><input type="number" step=".01" data-review="'+i+'" data-field="amount" value="'+c.amount+'"></td><td><select data-review="'+i+'" data-field="category">'+CATEGORIES.map(function(x){return '<option value="'+x+'"'+(x===c.category?" selected":"")+'>'+x+'</option>';}).join("")+'</select></td></tr>';}).join("");
  modal('<header class="modal-head"><div><div class="section-kicker">Revision obligatoria</div><h2>Revisa '+stagedImport.candidates.length+' movimientos</h2><p>'+safe(stagedImport.fileName)+' no se guardara hasta confirmar.</p></div><button class="icon-button modal-close" data-action="close-modal"><span data-icon="close"></span></button></header><form id="review-form"><div class="modal-body"><div class="review-summary"><span data-icon="info"></span><span>Las categorias sugeridas se pueden corregir. El lote se podra deshacer despues de confirmarlo.</span></div><div class="review-table-wrap"><table class="data-table review-table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Importe</th><th>Categoria</th></tr></thead><tbody>'+rows+'</tbody></table></div></div><footer class="modal-foot"><button type="button" class="btn" data-action="close-modal">Cancelar</button><button class="btn btn-primary">Confirmar importacion</button></footer></form>',true);
}
function unsupported(files){modal('<header class="modal-head"><div><div class="section-kicker">Importador seguro</div><h2>Archivo preparado para el backend</h2><p>Has seleccionado: '+files.map(function(f){return safe(f.name);}).join(", ")+'</p></div><button class="icon-button modal-close" data-action="close-modal"><span data-icon="close"></span></button></header><div class="modal-body"><div class="source-warning"><strong>Extraccion no disponible en GitHub Pages</strong>PDF, XLSX e imagenes requieren un servicio privado de OCR y parsing. Esta pagina no envia ni guarda el archivo.</div><p class="panel-note" style="margin-top:15px">Al conectar el backend, el archivo se procesara de forma aislada y volvera a esta misma revision antes de confirmar.</p></div><footer class="modal-foot"><button class="btn" data-action="close-modal">Cerrar</button><button class="btn btn-primary" data-action="movement">Registrar manualmente</button></footer>');}
function effect(t,sign){
  const a=account(t.accountId);if(a)a.balance+=t.amount*sign;
  if(t.type==="investment_buy"||t.type==="investment_sell"){let asset=state.assets.find(function(x){return x.id==="manual-investment";}),delta=Math.abs(t.amount)*(t.type==="investment_buy"?sign:-sign);if(asset){asset.value+=delta;asset.cost+=delta;if(asset.value<=0)state.assets=state.assets.filter(function(x){return x!==asset;});}else if(delta>0)state.assets.push({id:"manual-investment",name:"Aportaciones registradas",ticker:"",group:"Inversiones",type:"ETF",value:delta,cost:delta});}
}
function storeMovement(form){
  const d=new FormData(form),type=d.get("type"),raw=Math.abs(parseNumber(d.get("amount")));if(!Number.isFinite(raw)||raw<=0){toast("Introduce un importe valido.",true);return;}
  const t={id:uid("t"),date:d.get("date"),merchant:d.get("merchant").trim(),description:d.get("description").trim(),amount:(type==="expense"||type==="investment_buy")?-raw:raw,type:type,category:type==="income"?"Ingresos":type.startsWith("investment")?"Inversiones":d.get("category"),accountId:d.get("accountId")};
  state.transactions.push(t);effect(t,1);snapshot();save();close();render();toast("Movimiento guardado y recalculado.");
}
function confirmImport(){
  if(!stagedImport)return;const ids=[];stagedImport.candidates.forEach(function(c){const t=Object.assign({},c,{id:uid("t"),importId:stagedImport.id});if(t.type==="expense"&&t.amount>0)t.amount*=-1;state.transactions.push(t);effect(t,1);ids.push(t.id);});state.imports.push({id:stagedImport.id,fileName:stagedImport.fileName,createdAt:stagedImport.createdAt,count:ids.length,ids:ids});snapshot();save();const count=ids.length;stagedImport=null;close();go("movimientos");toast(count+" movimientos importados correctamente.");
}
function undo(id){
  const record=state.imports.find(function(x){return x.id===id;});if(!record)return;const set=new Set(record.ids);state.transactions.filter(function(t){return set.has(t.id);}).forEach(function(t){effect(t,-1);});state.transactions=state.transactions.filter(function(t){return !set.has(t.id);});state.imports=state.imports.filter(function(x){return x.id!==id;});snapshot();save();render();toast("Importacion deshecha.");
}
function dropZone(){const z=document.getElementById("drop-zone"),input=document.getElementById("file-input");if(!z||!input)return;z.addEventListener("dragover",function(e){e.preventDefault();z.classList.add("is-dragging");});z.addEventListener("dragleave",function(){z.classList.remove("is-dragging");});z.addEventListener("drop",function(e){e.preventDefault();z.classList.remove("is-dragging");upload(e.dataTransfer.files);});}
function ask(q){const value=String(q||"").trim();if(!value)return;chat.push({role:"user",text:value},{role:"assistant",text:answer(value)});if(currentView!=="coach")go("coach");else{render();const m=document.getElementById("messages");if(m)m.scrollTop=m.scrollHeight;}}

document.addEventListener("click",function(e){
  const v=e.target.closest("[data-view]");if(v){go(v.dataset.view);return;}
  const b=e.target.closest("[data-action]");if(!b)return;const action=b.dataset.action;
  if(action==="close-modal"){if(!e.target.closest("[data-modal-content]")||b===e.target)close();}
  else if(action==="toggle-menu")document.querySelector(".app-shell").classList.toggle("menu-open");
  else if(action==="movement")movementModal(b.dataset.invest==="true");
  else if(action==="goal")goalModal(b.dataset.id);
  else if(action==="account")accountModal();
  else if(action==="open-settings")settings();
  else if(action==="open-import")go("importar");
  else if(action==="show-alerts")alertsModal();
  else if(action==="alerts")alertsModal();
  else if(action==="ask")ask(b.dataset.q);
  else if(action==="delete"){const t=state.transactions.find(function(x){return x.id===b.dataset.id;});if(t&&confirm("¿Eliminar este movimiento?")){effect(t,-1);state.transactions=state.transactions.filter(function(x){return x!==t;});snapshot();save();render();toast("Movimiento eliminado.");}}
  else if(action==="undo")undo(b.dataset.id);
  else if(action==="reset"){if(confirm("¿Restablecer todos los datos locales de ejemplo?")){state=repository.reset();chat=[];close();render();toast("Datos de ejemplo restablecidos.");}}
});
document.addEventListener("change",function(e){
  if(e.target.id==="file-input"){upload(e.target.files);e.target.value="";}
  if(e.target.id==="type-filter"){filter.type=e.target.value;render();}
  if(e.target.dataset.review!==undefined&&stagedImport){const c=stagedImport.candidates[Number(e.target.dataset.review)],field=e.target.dataset.field;c[field]=field==="amount"?parseNumber(e.target.value):e.target.value;}
});
document.addEventListener("input",function(e){
  if(e.target.id==="search"){filter.search=e.target.value;render();const input=document.getElementById("search");if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length);}}
  if(e.target.dataset.review!==undefined&&stagedImport){const c=stagedImport.candidates[Number(e.target.dataset.review)],field=e.target.dataset.field;c[field]=field==="amount"?parseNumber(e.target.value):e.target.value;}
});
document.addEventListener("submit",function(e){
  e.preventDefault();
  if(e.target.id==="movement-form")storeMovement(e.target);
  else if(e.target.id==="goal-form"){const d=new FormData(e.target),old=state.goals.find(function(g){return g.id===e.target.dataset.id;}),g={id:old?old.id:uid("goal"),name:d.get("name").trim(),target:Number(d.get("target")),current:Number(d.get("current")),date:d.get("date"),priority:d.get("priority")};if(old)Object.assign(old,g);else state.goals.push(g);save();close();render();toast("Objetivo guardado.");}
  else if(e.target.id==="account-form"){const d=new FormData(e.target);state.accounts.push({id:uid("account"),name:d.get("name").trim(),kind:d.get("kind"),balance:Number(d.get("balance"))});snapshot();save();close();render();toast("Cuenta anadida al patrimonio.");}
  else if(e.target.id==="settings-form"){const d=new FormData(e.target);state.profile={name:d.get("name").trim(),risk:d.get("risk"),emergency:Number(d.get("emergency")),contribution:Number(d.get("contribution"))};save();close();render();toast("Preferencias actualizadas.");}
  else if(e.target.id==="review-form")confirmImport();
  else if(e.target.id==="chat-form"){const input=e.target.elements.question;ask(input.value);input.value="";}
});
hydrate();render();
