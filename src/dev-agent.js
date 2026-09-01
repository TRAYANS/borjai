const STORAGE_KEY = "borjai:mvp:v1";

function readAccessToken() {
  try {
    const direct = JSON.parse(localStorage.getItem("borjai:supabase:session:v1") || "null");
    if (direct?.access_token) return direct.access_token;
  } catch (_) {}
  if (window.BORJAI_SESSION_TOKEN) return window.BORJAI_SESSION_TOKEN;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i) || "";
    if (!key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "null");
      const token = raw?.access_token || raw?.currentSession?.access_token || raw?.session?.access_token;
      if (token) return token;
    } catch (_) {}
  }
  return "";
}

function addAgentUI() {
  if (document.getElementById("dev-agent-card")) return;
  const coachView = document.querySelector(".coach-view");
  if (!coachView) return;
  const card = document.createElement("section");
  card.id = "dev-agent-card";
  card.className = "panel";
  card.style.cssText = "margin-top:14px;padding:16px;border:1px solid rgba(243,45,58,.28);background:linear-gradient(135deg,rgba(243,45,58,.07),rgba(255,255,255,.02));border-radius:14px";
  card.innerHTML = `<div class="section-kicker">AI Developer</div><h2 style="margin:4px 0 6px;font-size:18px">Reprogramar BorjaAI</h2><p class="panel-note" style="margin-bottom:12px">Describe un cambio. El agente analiza el repositorio, prepara el código, crea una rama y abre un Pull Request para que puedas revisar el preview de Vercel antes de tocar producción.</p><form id="dev-agent-form"><div style="display:flex;gap:8px;align-items:stretch"><input name="task" required maxlength="6000" placeholder="Ej. Añade un filtro para comparar gastos por categoría…" style="flex:1;min-width:0;padding:11px 12px;border-radius:10px;border:1px solid var(--line,#30343c);background:#0b0d11;color:#fff"><button class="btn btn-primary" type="submit">Programar</button></div><div id="dev-agent-status" class="panel-note" style="margin-top:10px"></div></form>`;
  coachView.appendChild(card);
  const form = card.querySelector("#dev-agent-form");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const task = String(new FormData(form).get("task") || "").trim();
    const status = card.querySelector("#dev-agent-status");
    if (!task) return;
    const token = readAccessToken();
    if (!token) { status.textContent = "No encuentro tu sesión de Supabase. Recarga la aplicación e inténtalo de nuevo."; return; }
    const button = form.querySelector("button");
    button.disabled = true;
    status.textContent = "Analizando el repositorio y preparando el cambio…";
    try {
      const response = await fetch("/api/dev-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ task })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "No se pudo programar el cambio.");
      const files = Array.isArray(payload.changedFiles) ? payload.changedFiles.join(", ") : "";
      const pr = payload.prUrl ? `<a href="${payload.prUrl}" target="_blank" rel="noreferrer" style="color:#ff7a82">Revisar Pull Request y preview de Vercel →</a>` : "";
      status.innerHTML = `<strong style="color:#fff">Cambio preparado.</strong> ${payload.summary || ""}${files ? `<br><span>Archivos: ${files}</span>` : ""}${pr ? `<br>${pr}` : ""}`;
      form.reset();
    } catch (error) {
      status.textContent = `No se pudo completar: ${error.message}`;
    } finally {
      button.disabled = false;
    }
  });
}

const observer = new MutationObserver(addAgentUI);
observer.observe(document.body, { childList: true, subtree: true });
addAgentUI();
