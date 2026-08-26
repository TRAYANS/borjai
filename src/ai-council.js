const STORAGE_KEY = "borjai:mvp:v1";
const SESSION_KEY = "borjai:supabase:session:v1";
const AUTH_KEY_HINT = "sb-";

function readState() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    return raw && typeof raw === "object" ? raw : {};
  } catch (_) { return {}; }
}

function readAccessToken() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (session?.access_token) return session.access_token;
  } catch (_) {}
  if (window.BORJAI_SESSION_TOKEN) return window.BORJAI_SESSION_TOKEN;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i) || "";
    if (!key.startsWith(AUTH_KEY_HINT) || !key.endsWith("-auth-token")) continue;
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "null");
      const token = raw?.access_token || raw?.currentSession?.access_token || raw?.session?.access_token;
      if (token) return token;
    } catch (_) {}
  }
  return "";
}

function contextFromState(state) {
  const tx = Array.isArray(state.transactions) ? state.transactions.slice(-200) : [];
  const accounts = Array.isArray(state.accounts) ? state.accounts : [];
  const assets = Array.isArray(state.assets) ? state.assets : [];
  const debts = Array.isArray(state.debts) ? state.debts : [];
  const goals = Array.isArray(state.goals) ? state.goals : [];
  const snapshots = Array.isArray(state.snapshots) ? state.snapshots.slice(-90) : [];
  const month = new Date().toISOString().slice(0, 7);
  const monthTx = tx.filter((t) => String(t.date || "").startsWith(month));
  const income = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount || 0), 0);
  const expense = monthTx.filter((t) => ["expense", "fee"].includes(t.type)).reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);
  const investments = assets.filter((a) => ["Inversiones", "Criptomonedas", "Oro y Metales"].includes(a.group));
  const netWorth = accounts.reduce((s, a) => s + Number(a.balance || 0), 0) + assets.reduce((s, a) => s + Number(a.value || 0), 0) - debts.reduce((s, d) => s + Number(d.balance || d.outstandingBalance || 0), 0);
  return {
    profile: state.profile || {},
    netWorth,
    monthly: { income, expense, savings: income - expense },
    accounts,
    assets,
    investments,
    debts,
    goals,
    snapshots,
    recentTransactions: tx
  };
}

function addCouncilUI() {
  if (document.getElementById("ai-council-banner")) return;
  const coachView = document.querySelector(".coach-view");
  if (!coachView) return;
  const banner = document.createElement("div");
  banner.id = "ai-council-banner";
  banner.style.cssText = "margin:0 0 12px;padding:10px 12px;border:1px solid rgba(243,45,58,.25);border-radius:12px;background:rgba(243,45,58,.05);color:#dfe2e7;font-size:12px";
  banner.innerHTML = `<strong style="color:#fff">Consejo IA</strong><span style="margin-left:8px;color:#9da3ad">Varios modelos analizan tu situación y un juez IA sintetiza la respuesta.</span>`;
  coachView.insertBefore(banner, coachView.firstChild);
}

function replaceMessage(text, loading = false) {
  const messages = document.getElementById("messages");
  if (!messages) return;
  const node = document.createElement("div");
  node.className = "chat-message";
  node.dataset.aiCouncilMessage = "1";
  node.innerHTML = `<div class="chat-avatar coach-avatar-fallback" aria-hidden="true"><span>B</span><i>AI</i></div><div class="chat-bubble">${loading ? "Consultando el consejo IA…" : text.replace(/[&<>]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])).replace(/\n/g,"<br>")}</div>`;
  messages.appendChild(node);
  messages.scrollTop = messages.scrollHeight;
  return node;
}

async function askCouncil(question) {
  const token = readAccessToken();
  if (!token) throw new Error("No encuentro la sesión de Supabase en este navegador. Recarga la app e inténtalo de nuevo.");
  const response = await fetch("/api/coach", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question, context: contextFromState(readState()), useWeb: true })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "No se pudo consultar el consejo IA.");
  return payload;
}

function wireChatForm(form) {
  if (!form || form.dataset.aiCouncilWired === "1") return;
  form.dataset.aiCouncilWired = "1";
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    event.stopImmediatePropagation();
    const question = String(new FormData(form).get("question") || "").trim();
    if (!question) return;
    const input = form.querySelector("input[name=question]");
    const button = form.querySelector("button");
    if (input) input.value = "";
    if (button) button.disabled = true;
    const loadingNode = replaceMessage("", true);
    try {
      const result = await askCouncil(question);
      if (loadingNode) loadingNode.remove();
      const label = Array.isArray(result.providers) && result.providers.length ? `\n\n— Consejo: ${result.providers.join(" + ")} → ${result.judge}` : "";
      replaceMessage(String(result.answer || "No se obtuvo respuesta.") + label);
    } catch (error) {
      if (loadingNode) loadingNode.remove();
      replaceMessage(`No pude completar el consejo IA: ${error.message}`);
    } finally {
      if (button) button.disabled = false;
      if (input) input.focus();
    }
  }, true);
}

function boot() {
  addCouncilUI();
  wireChatForm(document.getElementById("chat-form"));
}
const observer = new MutationObserver(boot);
observer.observe(document.body, { childList: true, subtree: true });
boot();
