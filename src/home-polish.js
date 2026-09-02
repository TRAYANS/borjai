const STYLE_ID = "borjai-home-polish-v1";
const CLOCK_ID = "borjai-madrid-clock";
const ROBOT_SRC = "/assets/borjai-robot.jpg?v=1";

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .borjai-clock {
      display:flex;
      align-items:center;
      gap:11px;
      min-width:154px;
      padding:8px 13px;
      border:1px solid rgba(243,45,58,.28);
      border-radius:12px;
      background:linear-gradient(135deg,rgba(20,22,28,.96),rgba(12,14,18,.92));
      box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 8px 24px rgba(0,0,0,.18);
    }
    .borjai-clock-face {
      width:30px;
      height:30px;
      border:1.5px solid rgba(243,45,58,.85);
      border-radius:50%;
      position:relative;
      flex:0 0 auto;
      box-shadow:0 0 14px rgba(243,45,58,.16);
    }
    .borjai-clock-face:before,.borjai-clock-face:after {
      content:"";
      position:absolute;
      left:50%; top:50%;
      width:1.5px;
      border-radius:2px;
      background:#f5f7fa;
      transform-origin:50% 100%;
    }
    .borjai-clock-face:before { height:8px; transform:translate(-50%,-100%) rotate(0deg); }
    .borjai-clock-face:after { height:6px; transform:translate(-50%,-100%) rotate(110deg); }
    .borjai-clock-copy { display:flex; flex-direction:column; line-height:1.05; }
    .borjai-clock-time { font-size:18px; font-weight:800; letter-spacing:-.02em; font-variant-numeric:tabular-nums; }
    .borjai-clock-zone { margin-top:4px; color:#858c98; font-size:9px; letter-spacing:.08em; text-transform:uppercase; white-space:nowrap; }
    .coach-art.borjai-robot-art {
      position:relative;
      display:flex;
      align-items:flex-end;
      justify-content:flex-end;
      overflow:hidden;
      min-width:290px;
      height:100%;
      background:radial-gradient(circle at 60% 50%,rgba(243,45,58,.12),transparent 60%);
    }
    .borjai-robot-art img {
      width:min(320px,100%);
      height:100%;
      object-fit:cover;
      object-position:center;
      display:block;
      mix-blend-mode:screen;
      filter:contrast(1.04) saturate(.92) drop-shadow(0 14px 28px rgba(0,0,0,.42));
    }
    .coach-art.borjai-robot-art:after {
      content:"";
      position:absolute;
      inset:0;
      pointer-events:none;
      background:linear-gradient(90deg,#111419 0%,rgba(17,20,25,.55) 13%,transparent 42%,transparent 78%,rgba(9,10,13,.18));
    }
    .chat-avatar.borjai-robot-avatar {
      overflow:hidden;
      background:#0c0f14;
      border:1px solid rgba(243,45,58,.4);
    }
    .borjai-robot-avatar img { width:100%; height:100%; object-fit:cover; object-position:center; mix-blend-mode:screen; }
    .side-stack .insight-card .text-button[data-action="alerts"] {
      display:inline-flex;
      align-items:center;
      gap:10px;
      margin-top:10px;
      padding:9px 13px;
      border:1px solid rgba(243,45,58,.42);
      border-radius:9px;
      background:rgba(243,45,58,.07);
      color:#f5f7fa;
      font-weight:750;
      transition:background .18s ease,border-color .18s ease,transform .18s ease;
    }
    .side-stack .insight-card .text-button[data-action="alerts"]:after { content:"→"; color:#f32d3a; font-size:17px; line-height:1; }
    .side-stack .insight-card .text-button[data-action="alerts"]:hover { background:rgba(243,45,58,.13); border-color:rgba(243,45,58,.75); transform:translateY(-1px); }
    @media(max-width:900px){
      .borjai-clock { min-width:0; padding:7px 9px; }
      .borjai-clock-zone { display:none; }
      .borjai-clock-copy { display:none; }
      .borjai-clock-face { width:28px; height:28px; }
      .coach-art.borjai-robot-art { min-width:0; height:180px; }
    }
  `;
  document.head.appendChild(style);
}

function updateClock() {
  const el = document.getElementById(CLOCK_ID);
  if (!el) return;
  const now = new Date();
  const time = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(now);
  const zone = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    timeZoneName: "short"
  }).formatToParts(now).find(p => p.type === "timeZoneName")?.value || "Europe/Madrid";
  const timeEl = el.querySelector(".borjai-clock-time");
  const zoneEl = el.querySelector(".borjai-clock-zone");
  if (timeEl) timeEl.textContent = time;
  if (zoneEl) zoneEl.textContent = `Europe/Madrid · ${zone}`;
}

function ensureClock() {
  const actions = document.querySelector(".topbar-actions");
  if (!actions || document.getElementById(CLOCK_ID)) return;
  const clock = document.createElement("div");
  clock.id = CLOCK_ID;
  clock.className = "borjai-clock";
  clock.setAttribute("aria-label", "Hora de Madrid");
  clock.innerHTML = '<span class="borjai-clock-face" aria-hidden="true"></span><span class="borjai-clock-copy"><strong class="borjai-clock-time">--:--:--</strong><span class="borjai-clock-zone">Europe/Madrid</span></span>';
  actions.prepend(clock);
  updateClock();
}

function updateGreeting() {
  const title = document.getElementById("topbar-title");
  if (!title) return;
  const profile = window.BORJAI_STATE?.profile || {};
  const name = String(profile.name || "Borja").trim() || "Borja";
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Madrid", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
  const greeting = hour >= 5 && hour < 12 ? "Buenos días" : hour >= 12 && hour < 20 ? "Buenas tardes" : "Buenas noches";
  if (title.closest(".page-context")) title.textContent = `${greeting}, ${name}`;
}

function enhanceRobot() {
  document.querySelectorAll(".coach-art.coach-fallback").forEach(el => {
    if (el.dataset.robotReady === "true") return;
    el.dataset.robotReady = "true";
    el.classList.add("borjai-robot-art");
    el.innerHTML = `<img src="${ROBOT_SRC}" alt="Asistente robot de BorjaAI">`;
  });
  document.querySelectorAll(".chat-avatar.coach-avatar-fallback, .coach-avatar-large.coach-fallback-large").forEach(el => {
    if (el.dataset.robotReady === "true") return;
    el.dataset.robotReady = "true";
    el.classList.add("borjai-robot-avatar");
    el.innerHTML = `<img src="${ROBOT_SRC}" alt="Asistente robot de BorjaAI">`;
  });
}

function refresh() {
  injectStyles();
  ensureClock();
  updateGreeting();
  enhanceRobot();
}

refresh();
setInterval(() => { updateClock(); updateGreeting(); }, 1000);
const observer = new MutationObserver(() => refresh());
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener("borjai:state", refresh);
