const COACH_MESSAGES_KEY = "borjai:coach:messages:v18";

function coachToken() {
  try {
    const session = JSON.parse(localStorage.getItem("borjai:supabase:session:v1") || "null");
    if (session?.access_token) return session.access_token;
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

function loadMessages() {
  try {
    const parsed = JSON.parse(localStorage.getItem(COACH_MESSAGES_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.slice(-40) : [];
  } catch (_) { return []; }
}

function saveMessages(messages) {
  try { localStorage.setItem(COACH_MESSAGES_KEY, JSON.stringify(messages.slice(-40))); } catch (_) {}
}

function cleanAnswer(value) {
  let text = String(value || "");
  // Never expose model reasoning, even when the provider forgets to close the tag.
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  text = text.replace(/<analysis>[\s\S]*?<\/analysis>/gi, "");
  text = text.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");
  text = text.replace(/<think>[\s\S]*$/gi, "");
  text = text.replace(/<analysis>[\s\S]*$/gi, "");
  text = text.replace(/<reasoning>[\s\S]*$/gi, "");
  text = text.replace(/^[\s\S]*<\/think>/gi, "");
  text = text.replace(/^[\s\S]*<\/analysis>/gi, "");
  text = text.replace(/^[\s\S]*<\/reasoning>/gi, "");
  text = text.replace(/^\s*```(?:markdown|md|text)?\s*/i, "");
  text = text.replace(/\s*```\s*$/i, "");
  return text.trim();
}

function formatAnswer(value) {
  const safe = cleanAnswer(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
  return safe
    .replace(/^###\s+(.+)$/gm, "<strong>$1</strong>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^[-•]\s+/gm, "• ")
    .replace(/\n/g, "<br>");
}

function contextFromState(state) {
  const transactions = Array.isArray(state?.transactions) ? state.transactions.slice(-200) : [];
  const accounts = Array.isArray(state?.accounts) ? state.accounts : [];
  const assets = Array.isArray(state?.assets) ? state.assets : [];
  const debts = Array.isArray(state?.debts) ? state.debts : [];
  const goals = Array.isArray(state?.goals) ? state.goals : [];
  const snapshots = Array.isArray(state?.snapshots) ? state.snapshots.slice(-90) : [];
  const month = new Date().toISOString().slice(0, 7);
  const monthTx = transactions.filter((t) => String(t.date || "").startsWith(month));
  const income = monthTx.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount || 0), 0);
  const expense = monthTx.filter((t) => ["expense", "fee"].includes(t.type)).reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);
  const netWorth = accounts.reduce((s, a) => s + Number(a.balance || 0), 0)
    + assets.reduce((s, a) => s + Number(a.value || 0), 0)
    - debts.reduce((s, d) => s + Number(d.balance || d.outstandingBalance || 0), 0);
  return {
    profile: state?.profile || {},
    netWorth,
    monthly: { income, expense, savings: income - expense },
    accounts,
    assets,
    debts,
    goals,
    snapshots,
    recentTransactions: transactions
  };
}

async function askCoach(question) {
  const token = coachToken();
  if (!token) throw new Error("No encuentro la sesión de Supabase. Recarga la aplicación e inténtalo de nuevo.");
  const stateResponse = await fetch("/api/state", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  const statePayload = await stateResponse.json().catch(() => ({}));
  if (!stateResponse.ok || !statePayload.state) throw new Error(statePayload?.error || "No se pudo cargar tu situación financiera desde Supabase.");
  const response = await fetch("/api/coach-v18", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question, context: contextFromState(statePayload.state), useWeb: true })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || "No se pudo consultar el asistente IA.");
  return payload;
}

function messageNode(message) {
  const row = document.createElement("div");
  row.className = "chat-message" + (message.role === "user" ? " user" : "");
  row.innerHTML = (message.role === "assistant" ? '<div class="chat-avatar coach-avatar-fallback" aria-hidden="true"><span>B</span></div>' : "")
    + '<div class="chat-bubble">' + (message.loading ? "Estoy analizando tus datos…" : (message.html ? message.html : formatAnswer(message.text))) + "</div>";
  return row;
}

function renderPersistentChat() {
  const messagesNode = document.getElementById("messages");
  if (!messagesNode) return;
  const messages = loadMessages();
  messagesNode.innerHTML = "";
  if (!messages.length) {
    messagesNode.appendChild(messageNode({
      role: "assistant",
      text: "Hola, Borja 👋 Soy tu asistente financiero. Puedo ayudarte con inversiones, ahorro, gastos, patrimonio y objetivos. Pregúntame lo que quieras."
    }));
    return;
  }
  messages.forEach((message) => messagesNode.appendChild(messageNode(message)));
  messagesNode.scrollTop = messagesNode.scrollHeight;
}

function addMessage(role, text, extra = {}) {
  const messages = loadMessages();
  const message = { role, text: cleanAnswer(text), ...extra };
  messages.push(message);
  saveMessages(messages);
  const node = document.getElementById("messages");
  if (node) {
    node.appendChild(messageNode(message));
    node.scrollTop = node.scrollHeight;
  }
  return message;
}

function setLoading(on) {
  const input = document.querySelector('#chat-form input[name="question"]');
  const button = document.querySelector('#chat-form button');
  if (input) input.disabled = on;
  if (button) button.disabled = on;
}

async function submitQuestion(question) {
  const value = String(question || "").trim();
  if (!value) return;
  addMessage("user", value);
  const greeting = /^(hola|holaa+|buenas|buenos días|buenas tardes|buenas noches|hey|hello)\s*[!.?]*$/i.test(value);
  if (greeting) {
    addMessage("assistant", "¡Hola, Borja! 👋 Estoy listo. Dime qué quieres mejorar: inversiones, ahorro, gastos, patrimonio u objetivos.");
    return;
  }
  setLoading(true);
  const messagesNode = document.getElementById("messages");
  const loading = messageNode({ role: "assistant", loading: true });
  if (messagesNode) { messagesNode.appendChild(loading); messagesNode.scrollTop = messagesNode.scrollHeight; }
  try {
    const result = await askCoach(value);
    loading.remove();
    const answer = cleanAnswer(result.answer || "No se obtuvo respuesta.");
    addMessage("assistant", answer);
  } catch (error) {
    loading.remove();
    addMessage("assistant", `No pude completar el análisis: ${error.message}`);
  } finally {
    setLoading(false);
    const input = document.querySelector('#chat-form input[name="question"]');
    if (input) input.focus();
  }
}

function enhanceCoach() {
  const coachView = document.querySelector(".coach-view");
  if (!coachView) return;
  document.getElementById("ai-council-banner")?.remove();
  document.querySelector(".coach-context")?.remove();
  if (coachView.dataset.coachV18Enhanced === "1") return;
  coachView.dataset.coachV18Enhanced = "1";
  coachView.classList.add("coach-v18");
  renderPersistentChat();
}

document.addEventListener("click", (event) => {
  const action = event.target.closest?.('[data-action="ask"]');
  if (!action || !document.querySelector(".coach-view")) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  submitQuestion(action.dataset.q || "");
}, true);

document.addEventListener("submit", (event) => {
  if (event.target?.id !== "chat-form") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const input = event.target.elements.question;
  const value = input?.value || "";
  if (input) input.value = "";
  submitQuestion(value);
}, true);

const observer = new MutationObserver(() => enhanceCoach());
observer.observe(document.body, { childList: true, subtree: true });
enhanceCoach();
