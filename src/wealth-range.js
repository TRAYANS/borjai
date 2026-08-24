import { loadRuntimeConfig, LOCAL_STORAGE_KEY } from "./config.js";
import { createSupabaseClient } from "./db/supabaseClient.js";

const PERIODS = [
  { id: "1d", label: "1D", days: 1, note: "Último día" },
  { id: "1w", label: "1S", days: 7, note: "Última semana" },
  { id: "1m", label: "1M", days: 30, note: "Último mes" },
  { id: "3m", label: "3M", days: 90, note: "Últimos 3 meses" },
  { id: "6m", label: "6M", days: 180, note: "Últimos 6 meses" },
  { id: "1y", label: "1A", days: 365, note: "Últimos 12 meses" },
  { id: "3y", label: "3A", days: 1095, note: "Últimos 3 años" },
  { id: "5y", label: "5A", days: 1825, note: "Últimos 5 años" },
  { id: "max", label: "MAX", days: null, note: "Todo el histórico" }
];

const RANGE_KEY = "borjai:wealth-range";
let selected = localStorage.getItem(RANGE_KEY) || "1y";
let snapshots = [];
let initialized = false;

const money = value => new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(Number(value || 0)).replace(/\s/g, " ");
const signedMoney = value => !Number.isFinite(value) ? "—" : `${value >= 0 ? "+" : "−"}${money(Math.abs(value))}`;
const pct = value => new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 }).format(value);
const safe = value => String(value ?? "").replace(/[&<>\"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;" }[c]));

function normalizeRows(rows) {
  return (rows || []).map(row => ({
    date: String(row.snapshot_date || row.month || row.date || "").slice(0, 10),
    value: Number(row.net_worth ?? row.value ?? 0)
  })).filter(row => row.date && Number.isFinite(row.value)).sort((a,b) => a.date.localeCompare(b.date));
}

function readLocalRows() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "null");
    return normalizeRows(raw?.snapshots || []);
  } catch (_) { return []; }
}

async function readRemoteRows() {
  try {
    const config = await loadRuntimeConfig();
    if (!config.supabaseUrl || !config.supabaseAnonKey) return [];
    const client = await createSupabaseClient(config);
    const { data, error } = await client.from("wealth_snapshots").select("snapshot_date,net_worth").order("snapshot_date", { ascending: true });
    if (error) throw error;
    return normalizeRows(data);
  } catch (_) { return []; }
}

async function loadRows() {
  const [remote, local] = await Promise.all([readRemoteRows(), Promise.resolve(readLocalRows())]);
  snapshots = remote.length >= 2 ? remote : local;
}

function cutoffFor(period) {
  if (period.days == null) return null;
  const d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - period.days);
  return d.toISOString().slice(0,10);
}

function aggregate(rows, period) {
  if (rows.length < 2) return rows;
  const bucket = period.id === "max" || period.days >= 1095 ? "month" : period.days >= 180 ? "week" : "day";
  const map = new Map();
  rows.forEach(row => {
    const d = new Date(`${row.date}T12:00:00`);
    let key = row.date;
    if (bucket === "month") key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if (bucket === "week") { const start = new Date(d); const day = start.getDay() || 7; start.setDate(start.getDate() - day + 1); key = start.toISOString().slice(0,10); }
    map.set(key, row);
  });
  return [...map.values()].sort((a,b) => a.date.localeCompare(b.date));
}

function selectedRows() {
  const period = PERIODS.find(p => p.id === selected) || PERIODS[5];
  const cutoff = cutoffFor(period);
  const filtered = snapshots.filter(row => !cutoff || row.date >= cutoff);
  return { period, rows: aggregate(filtered, period) };
}

function buildChart(rows) {
  const width = 900, height = 260, pad = { top: 22, right: 18, bottom: 38, left: 18 };
  const innerW = width - pad.left - pad.right, innerH = height - pad.top - pad.bottom;
  const values = rows.map(r => r.value), min = Math.min(...values), max = Math.max(...values), span = Math.max(max-min, Math.abs(max)*0.04, 1);
  const lo = min - span*0.08, hi = max + span*0.08;
  const points = rows.map((row,i) => ({...row, x: pad.left + (rows.length === 1 ? innerW/2 : i/(rows.length-1)*innerW), y: pad.top + (1-(row.value-lo)/(hi-lo))*innerH}));
  const line = points.map((p,i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const base = height-pad.bottom;
  const area = `${line} L ${points.at(-1).x.toFixed(1)},${base} L ${points[0].x.toFixed(1)},${base} Z`;
  const labels = [points[0], points[Math.floor((points.length-1)/2)], points.at(-1)].filter((p,i,a) => p && a.findIndex(x => x.x === p.x) === i);
  const circles = points.length <= 60 ? points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3" fill="var(--red,#f32d3a)"/>`).join("") : "";
  return `<svg class="wealth-analysis-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Evolución del patrimonio"><defs><linearGradient id="wealth-analysis-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="rgba(243,45,58,.22)"/><stop offset="1" stop-color="rgba(243,45,58,0)"/></linearGradient></defs><path d="${area}" fill="url(#wealth-analysis-fill)"/><path d="${line}" fill="none" stroke="var(--red,#f32d3a)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>${circles}${labels.map(p => `<text x="${p.x}" y="${height-10}" text-anchor="${p.x < width*.2 ? "start" : p.x > width*.8 ? "end" : "middle"}" class="wealth-analysis-label">${safe(p.date)}</text>`).join("")}</svg>`;
}

function ensureStyles() {
  if (document.getElementById("wealth-analysis-styles")) return;
  const style = document.createElement("style"); style.id = "wealth-analysis-styles";
  style.textContent = `.wealth-analysis{margin-top:8px}.wealth-analysis-result{font-size:16px;font-weight:800}.wealth-analysis-result.positive{color:#39d98a}.wealth-analysis-result.negative{color:#ff5d68}.wealth-analysis-result.neutral{color:var(--text,#fff)}.wealth-analysis-sub{font-size:11px;color:var(--muted,#9da3ad);margin-bottom:3px}.wealth-analysis-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 12px}.wealth-analysis-metric{padding:9px 11px;border:1px solid var(--line-soft,#20232a);border-radius:9px;background:rgba(255,255,255,.018)}.wealth-analysis-metric span{display:block;color:var(--muted,#9da3ad);font-size:10px;text-transform:uppercase;letter-spacing:.06em}.wealth-analysis-metric strong{display:block;margin-top:3px;color:var(--text,#fff);font-size:13px}.wealth-analysis-chart{min-height:210px}.wealth-analysis-svg{display:block;width:100%;height:210px;overflow:visible}.wealth-analysis-label{fill:var(--muted,#9da3ad);font-size:11px}.wealth-analysis-empty{display:grid;min-height:210px;place-items:center;text-align:center;color:var(--muted,#9da3ad);font-size:13px;border:1px dashed var(--line,#292c33);border-radius:10px;padding:18px}@media(max-width:700px){.wealth-analysis-metrics{grid-template-columns:repeat(2,1fr)}}`;
  document.head.appendChild(style);
}

function syncSelector(panel, period) {
  const select = panel.querySelector(".period-select");
  if (select && select.value !== period.id) select.value = period.id;
  const note = panel.querySelector(".panel-head .panel-note");
  if (note) note.textContent = period.note;
}

function render(panel) {
  if (!panel) return;
  const original = panel.querySelector(".line-chart"); if (!original) return;
  ensureStyles();
  const { period, rows } = selectedRows();
  syncSelector(panel, period);
  let host = panel.querySelector(".wealth-analysis");
  if (!host) { host = document.createElement("div"); host.className = "wealth-analysis"; original.insertAdjacentElement("afterend", host); }
  original.style.display = "none";
  if (rows.length < 2) { host.innerHTML = `<div class="wealth-analysis-empty">No hay suficiente histórico para analizar ${safe(period.note.toLowerCase())}.<br><small>Añade snapshots de patrimonio y la gráfica se calculará automáticamente.</small></div>`; return; }
  const start = rows[0].value, end = rows.at(-1).value, change = end-start, changePct = start ? change/start : null;
  const high = Math.max(...rows.map(r=>r.value)), low = Math.min(...rows.map(r=>r.value));
  const cls = change > 0 ? "positive" : change < 0 ? "negative" : "neutral";
  host.innerHTML = `<div style="margin-bottom:10px"><div class="wealth-analysis-sub">${safe(period.note)}</div><div class="wealth-analysis-result ${cls}">${signedMoney(change)}${changePct == null ? "" : ` · ${pct(changePct)}`}</div></div><div class="wealth-analysis-metrics"><div class="wealth-analysis-metric"><span>Inicio</span><strong>${money(start)}</strong></div><div class="wealth-analysis-metric"><span>Actual</span><strong>${money(end)}</strong></div><div class="wealth-analysis-metric"><span>Máximo</span><strong>${money(high)}</strong></div><div class="wealth-analysis-metric"><span>Mínimo</span><strong>${money(low)}</strong></div></div><div class="wealth-analysis-chart">${buildChart(rows)}</div>`;
}

async function refresh() { await loadRows(); const panel = document.querySelector(".chart-panel"); if (panel) render(panel); }
function selectPeriod(id) { if (!PERIODS.some(p=>p.id===id)) return; selected=id; localStorage.setItem(RANGE_KEY,id); const panel=document.querySelector(".chart-panel"); if (panel) render(panel); }

function wireSelector() {
  const panel=document.querySelector(".chart-panel"); const select=panel?.querySelector(".period-select");
  if (!select || select.dataset.wealthAnalysisWired === "1") return;
  select.dataset.wealthAnalysisWired="1"; select.addEventListener("change",()=>selectPeriod(select.value));
}

function observePanel() {
  const observer = new MutationObserver(() => { const panel=document.querySelector(".chart-panel"); if (!panel) return; wireSelector(); if (!panel.querySelector(".wealth-analysis")) render(panel); });
  observer.observe(document.body,{childList:true,subtree:true});
}

async function init() {
  if (initialized) return; initialized=true; ensureStyles(); observePanel(); wireSelector(); await refresh();
  window.addEventListener("borjai:wealth-range-change", refresh);
  window.addEventListener("borjai:state-updated", refresh);
}

init();
