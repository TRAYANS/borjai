const PERIODS = [
  { id: "1d", label: "1D", days: 1 },
  { id: "1w", label: "1S", days: 7 },
  { id: "1m", label: "1M", days: 30 },
  { id: "3m", label: "3M", days: 90 },
  { id: "6m", label: "6M", days: 180 },
  { id: "1y", label: "1A", days: 365 },
  { id: "3y", label: "3A", days: 1095 },
  { id: "5y", label: "5A", days: 1825 },
  { id: "max", label: "MAX", days: null }
];

const STORAGE_KEY = "borjai:wealth-range";
let selected = localStorage.getItem(STORAGE_KEY) || "1y";

function money(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value).replace(/\s/g, " ");
}
function pct(value) {
  return new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 }).format(value);
}
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;" }[c]));
}
function getSnapshots() {
  try {
    const raw = JSON.parse(localStorage.getItem("borjai:mvp:v1") || "null");
    return (raw?.snapshots || []).map(s => ({
      date: s.snapshot_date || (s.month ? `${s.month}-01` : s.date),
      value: Number(s.net_worth ?? s.value)
    })).filter(s => s.date && Number.isFinite(s.value)).sort((a,b) => a.date.localeCompare(b.date));
  } catch (_) { return []; }
}
function cutoff(period) {
  if (period.days == null) return null;
  const d = new Date();
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() - period.days);
  return d.toISOString().slice(0,10);
}
function aggregate(rows, period) {
  const bucket = period.id === "max" || period.days >= 1095 ? "month" : period.days >= 180 ? "week" : "day";
  if (bucket === "day") return rows;
  const map = new Map();
  rows.forEach(r => {
    const d = new Date(`${r.date}T12:00:00`);
    let key = r.date;
    if (bucket === "month") key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`;
    if (bucket === "week") {
      const day = d.getDay() || 7;
      d.setDate(d.getDate() - day + 1);
      key = d.toISOString().slice(0,10);
    }
    map.set(key, r);
  });
  return [...map.values()].sort((a,b) => a.date.localeCompare(b.date));
}
function chart(rows) {
  if (rows.length < 2) return `<div class="wealth-range-empty">No hay histórico suficiente para este periodo.<br><small>Cuando existan más datos, este tramo se rellenará automáticamente.</small></div>`;
  const W=900,H=230,P=18;
  const values=rows.map(r=>r.value), min=Math.min(...values), max=Math.max(...values), span=Math.max(max-min,1);
  const points=rows.map((r,i)=>({ ...r, x:P+(rows.length===1?W/2:i/(rows.length-1)*(W-P*2)), y:18+(1-(r.value-(min-span*.08))/(span*1.16))*(H-52) }));
  const line=points.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area=`${line} L ${points.at(-1).x},${H-34} L ${points[0].x},${H-34} Z`;
  const labels=[points[0],points[Math.floor((points.length-1)/2)],points.at(-1)].filter((p,i,a)=>p && a.findIndex(x=>x.x===p.x)===i);
  return `<svg class="wealth-range-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Evolución del patrimonio"><defs><linearGradient id="wealth-range-fill-v14" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f32d3a" stop-opacity=".28"/><stop offset="1" stop-color="#f32d3a" stop-opacity="0"/></linearGradient></defs><path d="${area}" fill="url(#wealth-range-fill-v14)"/><path d="${line}" fill="none" stroke="#f32d3a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${points.length<80?points.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="2.8" fill="#f32d3a"/>`).join(''):''}${labels.map(p=>`<text x="${p.x}" y="${H-8}" text-anchor="${p.x<W*.2?'start':p.x>W*.8?'end':'middle'}" fill="#9da3ad" font-size="11">${escapeHtml(new Intl.DateTimeFormat('es-ES',{day:'2-digit',month:'short'}).format(new Date(p.date+'T12:00:00')))}</text>`).join('')}</svg>`;
}
function styles() {
  if (document.getElementById("wealth-range-ui-styles")) return;
  const s=document.createElement("style"); s.id="wealth-range-ui-styles"; s.textContent=`
    .wealth-range-ui{margin-top:0}.wealth-range-toolbar{display:flex;justify-content:flex-start;margin:0 0 12px}.wealth-range-tabs{display:flex;gap:4px;padding:4px;border:1px solid var(--line,#292c33);border-radius:10px;background:rgba(255,255,255,.02);overflow:auto;width:max-content;max-width:100%}.wealth-range-tab{border:0;background:transparent;color:var(--muted,#9da3ad);font:700 11px system-ui,sans-serif;padding:8px 10px;border-radius:7px;cursor:pointer;white-space:nowrap}.wealth-range-tab.is-active{background:#f32d3a;color:#fff}.wealth-range-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-bottom:10px}.wealth-range-metric{padding:8px 10px;border:1px solid var(--line-soft,#20232a);border-radius:9px;background:rgba(255,255,255,.015)}.wealth-range-metric span{display:block;color:var(--muted,#9da3ad);font-size:9px;text-transform:uppercase;letter-spacing:.06em}.wealth-range-metric strong{display:block;color:var(--text,#fff);font-size:12px;margin-top:3px}.wealth-range-svg{display:block;width:100%;height:205px}.wealth-range-empty{display:grid;place-items:center;min-height:205px;text-align:center;color:var(--muted,#9da3ad);font-size:13px;border:1px dashed var(--line,#292c33);border-radius:10px}.wealth-range-empty small{font-size:11px}@media(max-width:700px){.wealth-range-tabs{width:100%}.wealth-range-tab{flex:1;padding:8px 6px}.wealth-range-metrics{grid-template-columns:repeat(2,1fr)}}`;
  document.head.appendChild(s);
}
function render(panel) {
  if (!panel) return;
  styles();
  const chartEl=panel.querySelector(".line-chart");
  if (!chartEl) return;
  let host=panel.querySelector(".wealth-range-ui");
  if (host) host.remove();
  chartEl.style.display="none";
  const period=PERIODS.find(p=>p.id===selected)||PERIODS[5];
  const all=getSnapshots();
  const cut=cutoff(period);
  const rows=aggregate(all.filter(r=>!cut||r.date>=cut),period);
  const first=rows[0]?.value,last=rows.at(-1)?.value;
  const change=Number.isFinite(first)&&Number.isFinite(last)?last-first:null;
  const max=rows.length?Math.max(...rows.map(r=>r.value)):null;
  const min=rows.length?Math.min(...rows.map(r=>r.value)):null;
  host=document.createElement("div"); host.className="wealth-range-ui";
  host.innerHTML=`<div class="wealth-range-toolbar"><div class="wealth-range-tabs">${PERIODS.map(p=>`<button class="wealth-range-tab ${p.id===selected?'is-active':''}" type="button" data-wealth-range="${p.id}">${p.label}</button>`).join('')}</div></div><div class="wealth-range-metrics"><div class="wealth-range-metric"><span>Actual</span><strong>${last==null?'—':money(last)}</strong></div><div class="wealth-range-metric"><span>Variación</span><strong>${change==null?'—':(change>=0?'+':'−')+money(Math.abs(change))}</strong></div><div class="wealth-range-metric"><span>Rentabilidad</span><strong>${first?pct(change/first):'—'}</strong></div><div class="wealth-range-metric"><span>Máx. / mín.</span><strong>${max==null?'—':money(max)+' / '+money(min)}</strong></div></div><div>${chart(rows)}</div>`;
  chartEl.insertAdjacentElement("afterend",host);
  host.querySelectorAll('[data-wealth-range]').forEach(btn=>btn.addEventListener('click',()=>{selected=btn.dataset.wealthRange;localStorage.setItem(STORAGE_KEY,selected);render(panel);}));
}
function boot(){
  const panel=document.querySelector('.chart-panel');
  if(panel) render(panel);
}
const observer=new MutationObserver(()=>boot());
observer.observe(document.body,{childList:true,subtree:true});
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
