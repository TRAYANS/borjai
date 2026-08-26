import { LOCAL_STORAGE_KEY } from "./config.js";

const KEY = "borjai:wealth-range";
const PERIODS = [
  ["1d", "1D", 1, "Último día"],
  ["1w", "1S", 7, "Última semana"],
  ["1m", "1M", 30, "Último mes"],
  ["3m", "3M", 90, "Últimos 3 meses"],
  ["6m", "6M", 180, "Últimos 6 meses"],
  ["1y", "1A", 365, "Últimos 12 meses"],
  ["3y", "3A", 1095, "Últimos 3 años"],
  ["5y", "5A", 1825, "Últimos 5 años"],
  ["max", "MAX", null, "Todo el histórico"]
];

function money(n) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0
  }).format(Number(n || 0)).replace(/\s/g, " ");
}
function pct(n) {
  return new Intl.NumberFormat("es-ES", {
    style: "percent", maximumFractionDigits: 1
  }).format(Number(n || 0));
}
function readState() {
  if (window.BORJAI_STATE && typeof window.BORJAI_STATE === "object") return window.BORJAI_STATE;
  try {
    const raw = JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || "null");
    return raw && typeof raw === "object" ? raw : null;
  } catch (_) {
    return null;
  }
}
function isoToday() { return new Date().toISOString().slice(0, 10); }
function rowDate(row) {
  return String(row?.date || (row?.month ? `${row.month}-01` : "")).slice(0, 10);
}
function rowsFromState(state) {
  return (Array.isArray(state?.snapshots) ? state.snapshots : [])
    .map((r) => ({ date: rowDate(r), value: Number(r.value || r.net_worth || 0) }))
    .filter((r) => r.date && Number.isFinite(r.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}
function cutoff(days) {
  if (days == null) return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function selectedPeriod() {
  const id = localStorage.getItem(KEY) || "1y";
  return PERIODS.find((p) => p[0] === id) || PERIODS[5];
}
function filteredRows() {
  const [, , days] = selectedPeriod();
  const rows = rowsFromState(readState());
  const c = cutoff(days);
  return rows.filter((r) => !c || r.date >= c);
}
function labelDate(d) {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(`${d}T12:00:00`)).replace(/\./g, "");
}
function aggregate(rows, periodId) {
  if (rows.length < 2) return rows;
  const p = PERIODS.find((x) => x[0] === periodId);
  const days = p?.[2];
  const bucket = periodId === "max" || days >= 1095 ? "month" : days >= 180 ? "week" : "day";
  if (bucket === "day") return rows;
  const map = new Map();
  rows.forEach((r) => {
    const d = new Date(`${r.date}T12:00:00`);
    let k = r.date;
    if (bucket === "month") k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (bucket === "week") {
      const x = new Date(d);
      const day = x.getDay() || 7;
      x.setDate(x.getDate() - day + 1);
      k = x.toISOString().slice(0, 10);
    }
    map.set(k, r);
  });
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}
function buildSvg(rows) {
  const W = 760, H = 250, L = 58, R = 14, T = 18, B = 42;
  const vals = rows.map((r) => r.value);
  const lo0 = Math.min(...vals), hi0 = Math.max(...vals);
  const span = Math.max(hi0 - lo0, 1);
  const lo = Math.max(0, lo0 - span * 0.08), hi = hi0 + span * 0.08;
  const x = (i) => rows.length === 1 ? W / 2 : L + (i / (rows.length - 1)) * (W - L - R);
  const y = (v) => T + ((hi - v) / Math.max(hi - lo, 1)) * (H - T - B);
  const pts = rows.map((r, i) => ({ ...r, x: x(i), y: y(r.value) }));
  const line = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${line} L ${pts.at(-1).x.toFixed(1)},${H - B} L ${pts[0].x.toFixed(1)},${H - B} Z`;
  const grid = [0, .33, .66, 1].map((n) => {
    const yy = T + (H - T - B) * n;
    const value = hi - (hi - lo) * n;
    return `<line class="grid" x1="${L}" y1="${yy}" x2="${W - R}" y2="${yy}"/><text x="2" y="${yy + 4}">${money(value)}</text>`;
  }).join("");
  const labelIndexes = [...new Set([0, Math.floor((pts.length - 1) / 2), pts.length - 1])];
  const labels = labelIndexes.map((i) => `<text x="${pts[i].x}" y="${H - 10}" text-anchor="middle">${labelDate(pts[i].date)}</text>`).join("");
  return `<svg class="wealth-range-main-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución del patrimonio">` +
    `<defs><linearGradient id="wealth-main-area" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#f32d3a" stop-opacity=".30"/><stop offset="1" stop-color="#f32d3a" stop-opacity="0"/></linearGradient></defs>` +
    grid + `<path d="${area}" class="area"/><path d="${line}" class="line"/>` +
    pts.slice(-1).map((p) => `<circle class="dot" cx="${p.x}" cy="${p.y}" r="5"/>`).join("") + labels + `</svg>`;
}
function metrics(rows) {
  if (!rows.length) return null;
  const first = rows[0].value, last = rows.at(-1).value;
  const change = last - first;
  return {
    first, last, change,
    changePct: first ? change / first : 0,
    max: Math.max(...rows.map((r) => r.value)),
    min: Math.min(...rows.map((r) => r.value))
  };
}
function ensureStyles() {
  if (document.getElementById("wealth-dashboard-styles")) return;
  const style = document.createElement("style");
  style.id = "wealth-dashboard-styles";
  style.textContent = `
    .wealth-dashboard-body{margin-top:12px}
    .wealth-dashboard-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}
    .wealth-dashboard-metric{border:1px solid var(--line-soft,#20232a);border-radius:10px;padding:10px 12px;background:rgba(255,255,255,.018)}
    .wealth-dashboard-metric span{display:block;color:var(--muted,#9da3ad);font-size:10px;text-transform:uppercase;letter-spacing:.05em}
    .wealth-dashboard-metric strong{display:block;margin-top:4px;font-size:13px;color:var(--text,#fff)}
    .wealth-dashboard-metric .positive{color:#39c978}.wealth-dashboard-metric .negative{color:#ff6770}
    .wealth-dashboard-empty{min-height:230px;display:grid;place-items:center;text-align:center;border:1px dashed var(--line,#292c33);border-radius:10px;color:var(--muted,#9da3ad);padding:20px}
    .wealth-range-main-chart{display:block;width:100%;height:250px;overflow:visible}
    .wealth-range-main-chart .grid{stroke:rgba(255,255,255,.07);stroke-width:1}.wealth-range-main-chart text{fill:var(--muted,#9da3ad);font-size:11px}
    .wealth-range-main-chart .area{fill:url(#wealth-main-area)}.wealth-range-main-chart .line{fill:none;stroke:#f32d3a;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.wealth-range-main-chart .dot{fill:#f32d3a}
    @media(max-width:850px){.wealth-dashboard-metrics{grid-template-columns:repeat(2,1fr)}}
  `;
  document.head.appendChild(style);
}
function render(panel) {
  ensureStyles();
  const select = panel.querySelector(".period-select");
  const [, label, , note] = selectedPeriod();
  if (select) {
    select.innerHTML = PERIODS.map((p) => `<option value="${p[0]}">${p[1]}</option>`).join("");
    select.value = localStorage.getItem(KEY) || "1y";
    select.dataset.wealthDashboardWired = "1";
  }
  const noteNode = panel.querySelector(".panel-head .panel-note");
  if (noteNode) noteNode.textContent = note;
  const rows = aggregate(filteredRows(), selectedPeriod()[0]);
  const target = panel.querySelector(".line-chart");
  if (!target) return;
  const m = metrics(rows);
  const body = document.createElement("div");
  body.className = "wealth-dashboard-body";
  if (!m || rows.length < 2) {
    body.innerHTML = `<div class="wealth-dashboard-empty">No hay suficiente histórico para este tramo todavía.<br><small>El histórico se irá construyendo automáticamente con tus snapshots.</small></div>`;
  } else {
    const tone = m.change >= 0 ? "positive" : "negative";
    body.innerHTML = buildSvg(rows) +
      `<div class="wealth-dashboard-metrics">` +
      `<div class="wealth-dashboard-metric"><span>Inicio</span><strong>${money(m.first)}</strong></div>` +
      `<div class="wealth-dashboard-metric"><span>Actual</span><strong>${money(m.last)}</strong></div>` +
      `<div class="wealth-dashboard-metric"><span>Variación</span><strong class="${tone}">${m.change >= 0 ? "+" : "−"}${money(Math.abs(m.change))}</strong></div>` +
      `<div class="wealth-dashboard-metric"><span>Rentabilidad</span><strong class="${tone}">${pct(m.changePct)}</strong></div>` +
      `</div>`;
  }
  target.style.display = "none";
  let enhanced = panel.querySelector(".wealth-dashboard-body");
  if (enhanced) enhanced.replaceWith(body); else target.insertAdjacentElement("afterend", body);
}
function wirePanel(panel) {
  const select = panel?.querySelector(".period-select");
  if (!select || select.dataset.wealthDashboardWired === "1") return;
  select.addEventListener("change", () => {
    localStorage.setItem(KEY, select.value);
    render(panel);
  });
  select.dataset.wealthDashboardWired = "1";
  render(panel);
}
function boot() {
  ensureStyles();
  const panel = document.querySelector(".chart-panel");
  if (panel) wirePanel(panel);
}
const observer = new MutationObserver(() => boot());
observer.observe(document.body, { childList: true, subtree: true });
boot();
setInterval(boot, 1500);
