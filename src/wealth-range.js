import { loadRuntimeConfig, LOCAL_STORAGE_KEY } from "./config.js";
import { createSupabaseClient } from "./db/supabaseClient.js";

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

const RANGE_KEY = "borjai:wealth-range";
let selected = localStorage.getItem(RANGE_KEY) || "1y";
let snapshots = [];
let loading = false;
let observerStarted = false;

function money(value) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
    .format(Number(value || 0)).replace(/\s/g, " ");
}

function pct(value) {
  return new Intl.NumberFormat("es-ES", { style: "percent", maximumFractionDigits: 1 }).format(value);
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[c]));
}

function normalizeRows(rows) {
  return (rows || [])
    .map(row => ({
      date: String(row.snapshot_date || row.month || row.date || "").slice(0, 10),
      value: Number(row.net_worth ?? row.value ?? 0)
    }))
    .filter(row => row.date && Number.isFinite(row.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function localSnapshots() {
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "null");
    return normalizeRows(raw?.snapshots || []);
  } catch (_) {
    return [];
  }
}

async function loadSnapshots() {
  const config = await loadRuntimeConfig();
  if (!config.supabaseUrl || !config.supabaseAnonKey) return localSnapshots();

  try {
    const client = await createSupabaseClient(config);
    const { data, error } = await client
      .from("wealth_snapshots")
      .select("snapshot_date,net_worth")
      .order("snapshot_date", { ascending: true });
    if (error) throw error;
    return normalizeRows(data);
  } catch (_) {
    return localSnapshots();
  }
}

function cutoffFor(period) {
  if (period.days == null) return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - period.days);
  return d.toISOString().slice(0, 10);
}

function aggregate(rows, period) {
  if (rows.length < 2) return rows;
  const bucket = period.id === "max" || period.days >= 1095 ? "month" : period.days >= 180 ? "week" : "day";
  const map = new Map();
  rows.forEach(row => {
    const d = new Date(`${row.date}T12:00:00`);
    let key = row.date;
    if (bucket === "month") key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (bucket === "week") {
      const start = new Date(d);
      const day = start.getDay() || 7;
      start.setDate(start.getDate() - day + 1);
      key = start.toISOString().slice(0, 10);
    }
    map.set(key, row);
  });
  return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function buildChart(rows) {
  const width = 900, height = 250;
  const pad = { top: 20, right: 18, bottom: 34, left: 18 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const values = rows.map(r => r.value);
  const min = Math.min(...values), max = Math.max(...values), span = Math.max(max - min, 1);
  const lo = min - span * 0.08, hi = max + span * 0.08;
  const points = rows.map((row, index) => {
    const x = pad.left + (rows.length === 1 ? innerW / 2 : index / (rows.length - 1) * innerW);
    const y = pad.top + (1 - (row.value - lo) / (hi - lo)) * innerH;
    return { ...row, x, y };
  });
  const line = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${points.at(-1).x.toFixed(1)},${height - pad.bottom} L ${points[0].x.toFixed(1)},${height - pad.bottom} Z`;
  const labels = [points[0], points[Math.floor((points.length - 1) / 2)], points.at(-1)]
    .filter((p, i, arr) => p && arr.findIndex(x => x.x === p.x) === i);
  return `<svg class="wealth-range-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img" aria-label="Evolución del patrimonio">
    <defs><linearGradient id="wealth-range-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="rgba(243,45,58,.25)"/><stop offset="1" stop-color="rgba(243,45,58,0)"/></linearGradient></defs>
    <path d="${area}" fill="url(#wealth-range-fill)" stroke="none"/>
    <path d="${line}" fill="none" stroke="var(--red,#f32d3a)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    ${points.length < 80 ? points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="3.2" fill="var(--red,#f32d3a)"/>`).join("") : ""}
    ${labels.map(p => `<text x="${p.x}" y="${height - 9}" text-anchor="${p.x < width * .2 ? "start" : p.x > width * .8 ? "end" : "middle"}" class="wealth-range-label">${escapeHtml(p.date)}</text>`).join("")}
  </svg>`;
}

function ensureStyles() {
  if (document.getElementById("wealth-range-styles")) return;
  const style = document.createElement("style");
  style.id = "wealth-range-styles";
  style.textContent = `
    .wealth-range-enhanced{margin-top:0}
    .wealth-range-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 14px;flex-wrap:wrap}
    .wealth-range-tabs{display:flex;gap:4px;padding:4px;border:1px solid var(--line,#292c33);border-radius:10px;background:var(--bg-raised,#0d0f13);overflow:auto;max-width:100%}
    .wealth-range-tab{border:0;background:transparent;color:var(--muted,#9da3ad);font:700 11px/1 system-ui,sans-serif;padding:8px 10px;border-radius:7px;cursor:pointer;white-space:nowrap}
    .wealth-range-tab:hover{color:var(--text,#fff);background:rgba(255,255,255,.04)}
    .wealth-range-tab.is-active{background:var(--red,#f32d3a);color:#fff}
    .wealth-range-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 12px}
    .wealth-range-metric{padding:9px 11px;border:1px solid var(--line-soft,#20232a);border-radius:9px;background:rgba(255,255,255,.018)}
    .wealth-range-metric span{display:block;color:var(--muted,#9da3ad);font-size:10px;text-transform:uppercase;letter-spacing:.06em}
    .wealth-range-metric strong{display:block;margin-top:3px;color:var(--text,#fff);font-size:13px}
    .wealth-range-chart{position:relative;min-height:205px}
    .wealth-range-svg{display:block;width:100%;height:205px;overflow:visible}
    .wealth-range-label{fill:var(--muted,#9da3ad);font-size:11px}
    .wealth-range-empty{display:grid;min-height:205px;place-items:center;text-align:center;color:var(--muted,#9da3ad);font-size:13px;border:1px dashed var(--line,#292c33);border-radius:10px;padding:18px}
    @media(max-width:700px){.wealth-range-metrics{grid-template-columns:repeat(2,1fr)}.wealth-range-tabs{width:100%}.wealth-range-tab{flex:1;padding:8px 7px}}
  `;
  document.head.appendChild(style);
}

function currentRows() {
  const period = PERIODS.find(p => p.id === selected) || PERIODS[5];
  const cutoff = cutoffFor(period);
  const filtered = snapshots.filter(row => !cutoff || row.date >= cutoff);
  return { period, rows: aggregate(filtered, period) };
}

function renderIntoPanel(panel) {
  if (!panel) return;
  ensureStyles();
  const chart = panel.querySelector(".line-chart");
  if (!chart) return;
  chart.style.display = "none";

  let enhanced = panel.querySelector(".wealth-range-enhanced");
  if (!enhanced) {
    enhanced = document.createElement("div");
    enhanced.className = "wealth-range-enhanced";
    chart.insertAdjacentElement("afterend", enhanced);
  }

  const { period, rows } = currentRows();
  const first = rows[0]?.value;
  const last = rows.at(-1)?.value;
  const change = Number.isFinite(first) && Number.isFinite(last) ? last - first : null;
  const changePct = first ? change / first : null;
  const max = rows.length ? Math.max(...rows.map(r => r.value)) : null;
  const min = rows.length ? Math.min(...rows.map(r => r.value)) : null;

  enhanced.innerHTML = `
    <div class="wealth-range-toolbar">
      <div class="wealth-range-tabs" role="tablist" aria-label="Periodo de evolución del patrimonio">
        ${PERIODS.map(p => `<button type="button" class="wealth-range-tab ${p.id === selected ? "is-active" : ""}" data-wealth-period="${p.id}" role="tab" aria-selected="${p.id === selected}">${p.label}</button>`).join("")}
      </div>
    </div>
    <div class="wealth-range-metrics">
      <div class="wealth-range-metric"><span>Actual</span><strong>${last == null ? "—" : money(last)}</strong></div>
      <div class="wealth-range-metric"><span>Variación</span><strong>${change == null ? "—" : `${change >= 0 ? "+" : "−"}${money(Math.abs(change))}`}</strong></div>
      <div class="wealth-range-metric"><span>Rentabilidad</span><strong>${changePct == null ? "—" : pct(changePct)}</strong></div>
      <div class="wealth-range-metric"><span>Máx. / mín.</span><strong>${max == null ? "—" : `${money(max)} / ${money(min)}`}</strong></div>
    </div>
    <div class="wealth-range-chart">
      ${rows.length >= 2 ? buildChart(rows) : `<div class="wealth-range-empty">No hay dos puntos de patrimonio dentro de ${period.label}.<br><small>Con histórico mensual, 3M y superiores mostrarán la evolución; 1D/1S/1M necesitan snapshots más frecuentes.</small></div>`}
    </div>
  `;
}

function selectPeriod(id) {
  if (!PERIODS.some(p => p.id === id)) return;
  selected = id;
  localStorage.setItem(RANGE_KEY, id);
  const panel = document.querySelector(".chart-panel");
  if (panel) renderIntoPanel(panel);
}

function wireDelegatedClicks() {
  if (document.documentElement.dataset.wealthRangeWired === "1") return;
  document.documentElement.dataset.wealthRangeWired = "1";
  document.addEventListener("click", event => {
    const button = event.target.closest?.("[data-wealth-period]");
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    selectPeriod(button.dataset.wealthPeriod);
  }, true);
}

function startObserver() {
  if (observerStarted) return;
  observerStarted = true;
  const observer = new MutationObserver(() => {
    const panel = document.querySelector(".chart-panel");
    if (!panel) return;
    const chart = panel.querySelector(".line-chart");
    if (chart && !panel.querySelector(".wealth-range-enhanced")) renderIntoPanel(panel);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

async function init() {
  if (loading) return;
  loading = true;
  ensureStyles();
  wireDelegatedClicks();
  startObserver();
  snapshots = await loadSnapshots();
  loading = false;
  const panel = document.querySelector(".chart-panel");
  if (panel) renderIntoPanel(panel);
  window.addEventListener("borjai:state-updated", async () => {
    snapshots = await loadSnapshots();
    const next = document.querySelector(".chart-panel");
    if (next) renderIntoPanel(next);
  });
}

init();
