/* Ingresos: compact, ordered visual view based on the supplied reference. */
(function () {
  const money = (n) => new Intl.NumberFormat('es-ES', {style:'currency', currency:'EUR', maximumFractionDigits:2}).format(Number(n)||0).replace(/\u00a0/g,' ');
  const monthName = () => {
    const text = new Intl.DateTimeFormat('es-ES',{month:'long',year:'numeric'}).format(new Date());
    return text.charAt(0).toUpperCase() + text.slice(1);
  };
  const icon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 17 6-6 4 4 6-7M15 8h5v5"/></svg>';
  function state(){ return window.BORJAI_STATE || {transactions:[],accounts:[]}; }
  function render(){
    const root=document.getElementById('app-view'); if(!root) return;
    const tx=(state().transactions||[]).filter(t=>String(t.date||'').slice(0,7)===new Date().toISOString().slice(0,7) && (t.type==='income'||t.type==='dividend'));
    const total=tx.reduce((s,t)=>s+Math.max(0,Number(t.amount)||0),0);
    const recurring=tx.filter(t=>/nomina|salario|sueldo|pension|pensi[oó]n/i.test(`${t.merchant||''} ${t.description||''}`)).reduce((s,t)=>s+Math.max(0,Number(t.amount)||0),0);
    const other=Math.max(0,total-recurring);
    const rows=tx.length?tx.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).map(t=>`<div class="income-row"><span>${String(t.date||'').slice(8,10)}/${String(t.date||'').slice(5,7)}</span><strong>${String(t.merchant||t.description||'Ingreso')}</strong><b>${money(t.amount)}</b></div>`).join(''):'<div class="income-empty">Aún no hay ingresos registrados este mes.</div>';
    root.innerHTML=`
      <section class="view income-view ingresos-view">
        <header class="view-head"><div><div class="section-kicker">ENTRADAS DE DINERO</div><h1>Ingresos</h1><p>Consulta de forma clara cuánto dinero entra y de dónde procede.</p></div><div class="view-head-actions"><button class="btn btn-primary" data-action="movement"><span>+</span> Registrar ingreso</button></div></header>
        <div class="income-summary-grid">
          <article class="income-card income-card-main"><span>INGRESOS TOTALES</span><strong>${money(total)}</strong><small>${monthName()}</small></article>
          <article class="income-card"><span>INGRESOS RECURRENTES</span><strong>${money(recurring)}</strong><small>Nómina, salario y similares</small></article>
          <article class="income-card"><span>OTROS INGRESOS</span><strong>${money(other)}</strong><small>Dividendos y entradas puntuales</small></article>
        </div>
        <div class="income-layout">
          <section class="panel income-overview"><div class="panel-head"><div><h2 class="panel-title">Resumen de ingresos</h2><span class="panel-note">${monthName()}</span></div></div><div class="income-overview-body"><div class="income-total-ring"><div><strong>${money(total)}</strong><span>Este mes</span></div></div><div class="income-breakdown"><div><span>Recurrentes</span><strong>${money(recurring)}</strong></div><div><span>Otros</span><strong>${money(other)}</strong></div><div><span>Número de ingresos</span><strong>${tx.length}</strong></div></div></div></section>
          <aside class="panel income-reading"><div class="section-kicker">LECTURA DE BORJAI</div><h2 class="panel-title">Cómo entra tu dinero</h2><p class="panel-note">${tx.length?'Los ingresos registrados este mes ya están incorporados al análisis financiero.':'Añade tu nómina, dividendos u otros ingresos para que Borjai pueda calcular tu tasa de ahorro real.'}</p><div class="income-reading-row"><span>Total del mes</span><strong>${money(total)}</strong></div><div class="income-reading-row"><span>Recurrente</span><strong>${money(recurring)}</strong></div><button class="btn btn-small" data-action="ask" data-q="ingresos">Analizar ingresos</button></aside>
        </div>
        <section class="table-shell income-recent"><div class="table-toolbar"><div><h2 class="panel-title">Ingresos recientes</h2><span class="panel-note">Movimientos clasificados como ingreso</span></div><button class="btn btn-small" data-view="movimientos">Ver movimientos</button></div>${rows}</section>
      </section>`;
  }
  document.addEventListener('click',function(e){
    const target=e.target.closest('[data-view="ingresos"]');
    if(!target) return;
    e.preventDefault(); e.stopImmediatePropagation();
    document.querySelectorAll('[data-view]').forEach(n=>n.classList.toggle('is-active',n===target));
    render(); window.scrollTo({top:0,behavior:'smooth'});
  },true);
  window.addEventListener('borjai:state',function(){ if(document.querySelector('.ingresos-view')) render(); });
  const css=document.createElement('style'); css.textContent=`
    .income-summary-grid{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:14px;margin-top:0}.income-card{min-height:112px;padding:17px;border:1px solid #29303a;border-radius:11px;background:linear-gradient(145deg,#0e1218,#0a0d12);display:flex;flex-direction:column;justify-content:center}.income-card span{font-size:9px;letter-spacing:.12em;font-weight:800;color:#aeb4be}.income-card strong{font-size:25px;line-height:1.05;margin:7px 0 4px}.income-card small{font-size:11px;color:#8f96a1}.income-card-main{border-color:rgba(69,196,106,.4)}
    .income-layout{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(330px,.75fr);gap:14px;margin-top:14px}.income-overview,.income-reading{min-height:330px;padding:19px}.income-overview-body{height:250px;display:grid;grid-template-columns:48% 52%;align-items:center;max-width:720px;margin:0 auto}.income-total-ring{width:190px;height:190px;margin:auto;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#45c46a 0deg,rgba(255,255,255,.1) 0deg);box-shadow:inset 0 0 0 34px #121419}.income-total-ring>div{text-align:center}.income-total-ring strong{display:block;font-size:24px}.income-total-ring span{display:block;margin-top:4px;color:#9299a5;font-size:11px}.income-breakdown{padding-right:25px}.income-breakdown>div{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.055);font-size:12px}.income-breakdown span{color:#a0a6af}.income-breakdown strong{font-size:13px}.income-reading{background:linear-gradient(145deg,#11151c,#151017)}.income-reading .panel-title{margin-top:5px;font-size:18px}.income-reading>p{margin:20px 0 10px;line-height:1.5}.income-reading-row{display:flex;justify-content:space-between;padding:13px 0;border-bottom:1px solid #242a32;font-size:12px}.income-reading-row strong{font-size:13px}.income-reading .btn{width:100%;margin-top:18px}.income-recent{margin-top:14px;overflow:hidden;min-height:240px}.income-row{display:grid;grid-template-columns:80px 1fr auto;gap:15px;align-items:center;padding:13px 17px;border-top:1px solid rgba(255,255,255,.055);font-size:12px}.income-row span{color:#9299a4}.income-row strong{font-size:13px}.income-row b{color:#45c46a}.income-empty{min-height:150px;display:grid;place-items:center;color:#8e95a0;font-size:12px}
    @media(max-width:950px){.income-summary-grid{grid-template-columns:1fr 1fr}.income-layout{grid-template-columns:1fr}.income-overview-body{max-width:620px}}@media(max-width:650px){.income-summary-grid{grid-template-columns:1fr}.income-overview-body{grid-template-columns:1fr;height:auto;padding:12px 0}.income-breakdown{padding:14px 0 0;width:100%}.income-total-ring{width:170px;height:170px}.income-row{grid-template-columns:55px 1fr auto}}
  `; document.head.appendChild(css);
})();
