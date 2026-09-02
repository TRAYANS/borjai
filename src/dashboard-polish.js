const CLOCK_ID = "borjai-clock";
const GREETING_ID = "borjai-greeting-sync";

function madridParts() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value || "00";
  return { hour: Number(get("hour")), time: `${get("hour")}:${get("minute")}:${get("second")}` };
}

function greeting(hour) {
  if (hour >= 6 && hour < 13) return "Buenos días";
  if (hour >= 13 && hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

function timezoneLabel() {
  const name = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", timeZoneName: "short" }).formatToParts(new Date()).find((part) => part.type === "timeZoneName")?.value || "Madrid";
  return `Madrid · ${name}`;
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
    clock.innerHTML = `<span class="borjai-clock-face" aria-hidden="true"><i></i><b></b></span><span class="borjai-clock-copy"><strong></strong><small></small></span>`;
    topbar.insertBefore(clock, actions);
  }
  const pageTitle = document.getElementById("topbar-title");
  const { hour, time } = madridParts();
  const word = greeting(hour);
  if (pageTitle && pageTitle.textContent !== `${word}, Borja`) pageTitle.textContent = `${word}, Borja`;
  const strong = clock.querySelector("strong");
  const small = clock.querySelector("small");
  if (strong && strong.textContent !== time) strong.textContent = time;
  const zone = timezoneLabel();
  if (small && small.textContent !== zone) small.textContent = zone;
  const context = document.querySelector(".page-context");
  if (context && !context.querySelector(`#${GREETING_ID}`)) {
    const dateNode = document.createElement("span");
    dateNode.id = GREETING_ID;
    dateNode.className = "borjai-date";
    dateNode.textContent = new Intl.DateTimeFormat("es-ES", { timeZone: "Europe/Madrid", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());
    context.appendChild(dateNode);
  }
}

// Borjai: robot humanoide, siempre en el lado DERECHO del coach.
const ROBOT_SVG = `<svg class="borjai-robot" viewBox="0 0 420 360" role="img" aria-label="Asistente robot Borjai" preserveAspectRatio="xMidYMid meet">
  <defs>
    <radialGradient id="rbGlow" cx="72%" cy="42%" r="58%"><stop offset="0" stop-color="#f21f35" stop-opacity=".26"/><stop offset=".55" stop-color="#8d1020" stop-opacity=".10"/><stop offset="1" stop-color="#090b0f" stop-opacity="0"/></radialGradient>
    <linearGradient id="rbMetal" x1="20%" y1="0" x2="80%" y2="100%"><stop stop-color="#ffffff"/><stop offset=".35" stop-color="#e7eaee"/><stop offset=".7" stop-color="#aeb4bb"/><stop offset="1" stop-color="#555c65"/></linearGradient>
    <linearGradient id="rbDark" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#444b54"/><stop offset="1" stop-color="#171b20"/></linearGradient>
    <radialGradient id="rbEye"><stop stop-color="#ffffff"/><stop offset=".25" stop-color="#67e8ff"/><stop offset=".68" stop-color="#0789d5"/><stop offset="1" stop-color="#06152b"/></radialGradient>
    <filter id="rbEyeGlow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs>
  <ellipse cx="305" cy="155" rx="145" ry="145" fill="url(#rbGlow)"/>
  <g transform="translate(118 5)">
    <path d="M82 129C82 62 126 24 188 27c67 3 103 47 101 110l-6 87c-4 62-40 96-94 98-63 1-99-34-103-96z" fill="url(#rbMetal)" stroke="#f5f7f9" stroke-width="2"/>
    <path d="M97 121c2-51 35-79 87-82 55-2 85 28 91 79" fill="none" stroke="#666d76" stroke-width="7" opacity=".65"/>
    <g fill="none" stroke="#4d555f" stroke-width="3" opacity=".78"><path d="M120 58v30l-16 15v27"/><path d="M150 40v34l14 15v24"/><path d="M216 39v34l-15 15v24"/><path d="M248 58v29l16 16v27"/><path d="M96 176h33l15 15v31"/><path d="M273 176h-31l-16 16v31"/></g>
    <g fill="#dce1e6" stroke="#59616a" stroke-width="2"><circle cx="120" cy="58" r="6"/><circle cx="248" cy="58" r="6"/><circle cx="96" cy="176" r="6"/><circle cx="273" cy="176" r="6"/></g>
    <path d="M124 134q28-28 54-1l-6 30q-26 14-49-2z" fill="#f8fafc" stroke="#7b838d" stroke-width="3"/>
    <path d="M198 133q28-28 55 2l4 27q-25 16-52 1z" fill="#f8fafc" stroke="#7b838d" stroke-width="3"/>
    <ellipse cx="151" cy="148" rx="14" ry="11" fill="url(#rbEye)" filter="url(#rbEyeGlow)"/><ellipse cx="225" cy="148" rx="14" ry="11" fill="url(#rbEye)" filter="url(#rbEyeGlow)"/>
    <circle cx="151" cy="148" r="4" fill="#fff"/><circle cx="225" cy="148" r="4" fill="#fff"/>
    <path d="M188 139l-12 58 20 8 14-16" fill="url(#rbDark)" stroke="#69717b" stroke-width="3"/>
    <path d="M134 214q54-22 111 1-10 48-55 55-45-7-56-56z" fill="#bdc2c8" stroke="#505760" stroke-width="3"/>
    <path d="M151 231q38 22 77 0" fill="none" stroke="#272c32" stroke-width="9" stroke-linecap="round"/>
    <path d="M159 229l5 14m13-10 4 15m14-15v15m15-16-4 15m18-17-6 14" stroke="#f2f4f6" stroke-width="2"/>
    <circle cx="112" cy="193" r="16" fill="#242a31" stroke="#a3a9b0" stroke-width="4"/><circle cx="112" cy="193" r="6" fill="#56ddff"/>
    <circle cx="268" cy="193" r="16" fill="#242a31" stroke="#a3a9b0" stroke-width="4"/><circle cx="268" cy="193" r="6" fill="#56ddff"/>
    <path d="M139 280q49 25 100 0l23 82H113z" fill="url(#rbMetal)" stroke="#5d646d" stroke-width="3"/>
    <path d="M165 298q25 14 51 0" fill="none" stroke="#3c434b" stroke-width="5"/>
    <path d="M191 298v44" stroke="#3c434b" stroke-width="3" opacity=".8"/>
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
setInterval(refresh, 1500);
