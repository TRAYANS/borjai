const CLOCK_ID = "borjai-clock";
const GREETING_ID = "borjai-greeting-sync";

function madridParts() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value || "00";
  return { hour: Number(get("hour")), time: `${get("hour")}:${get("minute")}:${get("second")}` };
}

function greeting(hour) {
  if (hour >= 6 && hour < 13) return "Buenos días";
  if (hour >= 13 && hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

function timezoneLabel() {
  const name = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", timeZoneName: "short" })
    .formatToParts(new Date()).find((part) => part.type === "timeZoneName")?.value || "Madrid";
  return name === "GMT+2" || name === "GMT+1" ? `Madrid · ${name}` : `Madrid · ${name}`;
}

function ensureClock() {
  const topbar = document.querySelector(".topbar");
  const actions = document.querySelector(".topbar-actions");
  if (!topbar || !actions) return;

  let clock = document.getElementById(CLOCK_ID);
  if (!clock) {
    clock = document.createElement("div");
    clock.id = CLOCK_ID;
    clock.className = "borjai-clock";
    clock.setAttribute("aria-label", "Hora actual de Madrid");
    clock.innerHTML = `
      <span class="borjai-clock-face" aria-hidden="true"><i></i><b></b></span>
      <span class="borjai-clock-copy"><strong></strong><small></small></span>
      <span class="borjai-clock-weather" aria-hidden="true">◷</span>
    `;
    topbar.insertBefore(clock, actions);
  }

  const pageTitle = document.getElementById("topbar-title");
  const { hour, time } = madridParts();
  const word = greeting(hour);
  if (pageTitle) pageTitle.textContent = `${word}, Borja`;
  const strong = clock.querySelector("strong");
  const small = clock.querySelector("small");
  if (strong) strong.textContent = time;
  if (small) small.textContent = timezoneLabel();

  const context = document.querySelector(".page-context");
  if (context && !context.querySelector(`#${GREETING_ID}`)) {
    const dateNode = document.createElement("span");
    dateNode.id = GREETING_ID;
    dateNode.className = "borjai-date";
    dateNode.textContent = new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long", year: "numeric"
    }).format(new Date());
    context.appendChild(dateNode);
  }
}

const ROBOT_SVG = `
<svg class="borjai-robot" viewBox="0 0 420 420" role="img" aria-label="Asistente robot Borjai">
  <defs>
    <radialGradient id="robot-bg" cx="50%" cy="45%" r="65%"><stop offset="0" stop-color="#3a1118" stop-opacity=".95"/><stop offset=".65" stop-color="#170d12" stop-opacity=".72"/><stop offset="1" stop-color="#0c0d11" stop-opacity="0"/></radialGradient>
    <linearGradient id="robot-metal" x1="15%" y1="0" x2="85%" y2="100%"><stop stop-color="#ffffff"/><stop offset=".42" stop-color="#dce0e5"/><stop offset=".72" stop-color="#9298a0"/><stop offset="1" stop-color="#555b64"/></linearGradient>
    <linearGradient id="robot-shadow" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#eef1f4"/><stop offset="1" stop-color="#747a83"/></linearGradient>
    <radialGradient id="eye" cx="50%" cy="50%" r="55%"><stop stop-color="#dfffff"/><stop offset=".35" stop-color="#40d9ff"/><stop offset=".72" stop-color="#0075c9"/><stop offset="1" stop-color="#03152b"/></radialGradient>
    <filter id="glow"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <ellipse cx="215" cy="220" rx="195" ry="195" fill="url(#robot-bg)"/>
  <g transform="translate(42 20)">
    <path d="M92 130 C94 62 148 25 215 29 C289 33 333 78 330 148 L322 257 C318 319 273 359 211 359 C143 359 99 320 95 256 Z" fill="url(#robot-metal)" stroke="#f5f7f9" stroke-opacity=".5" stroke-width="2"/>
    <path d="M112 128 C113 74 153 47 210 44 C271 42 306 77 310 130" fill="none" stroke="#4b515a" stroke-width="8" stroke-linecap="round" opacity=".55"/>
    <g fill="none" stroke="#3f4650" stroke-width="3" opacity=".75">
      <path d="M142 61v27l-18 17v28"/><path d="M171 48v27l16 16v20"/><path d="M245 45v32l-17 17v24"/><path d="M282 65v25l18 17v24"/>
      <path d="M115 190h34l15 15v35"/><path d="M307 188h-32l-16 17v36"/><path d="M122 278h39l17 18v29"/><path d="M298 277h-37l-18 19v29"/>
    </g>
    <g fill="#dfe3e7" stroke="#515861" stroke-width="2"><circle cx="142" cy="61" r="7"/><circle cx="300" cy="65" r="7"/><circle cx="115" cy="190" r="7"/><circle cx="307" cy="188" r="7"/><circle cx="122" cy="278" r="7"/><circle cx="298" cy="277" r="7"/></g>
    <path d="M153 156 Q178 130 202 153 L194 184 Q174 196 150 181Z" fill="#f7f8fa" stroke="#7a818a" stroke-width="3"/>
    <path d="M225 153 Q251 130 276 157 L279 181 Q254 196 232 184Z" fill="#f7f8fa" stroke="#7a818a" stroke-width="3"/>
    <ellipse cx="178" cy="165" rx="13" ry="10" fill="url(#eye)" filter="url(#glow)"/><ellipse cx="251" cy="166" rx="13" ry="10" fill="url(#eye)" filter="url(#glow)"/>
    <circle cx="178" cy="165" r="4" fill="#fff"/><circle cx="251" cy="166" r="4" fill="#fff"/>
    <path d="M213 157 L202 217 L221 225 L234 215" fill="url(#robot-shadow)" stroke="#626872" stroke-width="3"/>
    <path d="M160 242 Q213 222 267 244 Q254 292 211 299 Q170 291 160 242Z" fill="#b9bec5" stroke="#4d535c" stroke-width="3"/>
    <path d="M176 259 Q212 274 251 258" fill="none" stroke="#272c32" stroke-width="8" stroke-linecap="round"/>
    <path d="M178 258l6 13m11-10 4 13m13-13v14m13-15-4 14m16-16-6 13" stroke="#eef2f5" stroke-width="2" opacity=".8"/>
    <circle cx="145" cy="213" r="15" fill="#22272e" stroke="#9ba1a9" stroke-width="4"/><circle cx="145" cy="213" r="6" fill="#58dfff"/>
    <circle cx="283" cy="214" r="15" fill="#22272e" stroke="#9ba1a9" stroke-width="4"/><circle cx="283" cy="214" r="6" fill="#58dfff"/>
    <path d="M159 316 Q211 338 265 316 L282 388 H141Z" fill="url(#robot-shadow)" stroke="#5c626b" stroke-width="3"/>
    <path d="M177 330 Q211 348 247 330" fill="none" stroke="#3d434b" stroke-width="5"/>
  </g>
</svg>`;

function ensureRobot() {
  document.querySelectorAll(".coach-art").forEach((node) => {
    if (node.dataset.robotReady === "true") return;
    node.dataset.robotReady = "true";
    node.innerHTML = ROBOT_SVG;
  });
}

function refresh() {
  ensureClock();
  ensureRobot();
}

refresh();
const observer = new MutationObserver(refresh);
observer.observe(document.documentElement, { childList: true, subtree: true });
setInterval(ensureClock, 1000);
