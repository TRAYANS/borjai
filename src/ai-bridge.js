import { CATEGORIES } from "./importer.js";

const KEY = "borjai:mvp:v1";

function esc(value) {
  return String(value ?? "").replace(/[&<>\"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[c]));
}

function moneyValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.abs(n) : 0;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function accounts() {
  try {
    const state = JSON.parse(localStorage.getItem(KEY) || "null");
    return Array.isArray(state?.accounts) ? state.accounts : [];
  } catch (_) {
    return [];
  }
}

function accountOptions(selected) {
  return accounts().map(a => `<option value="${esc(a.id)}"${a.id === selected ? " selected" : ""}>${esc(a.name)}</option>`).join("");
}

function categoryOptions(selected) {
  return CATEGORIES.map(c => `<option value="${esc(c)}"${c === selected ? " selected" : ""}>${esc(c)}</option>`).join("");
}

function close() {
  document.getElementById("modal-root")?.replaceChildren();
}

function openTransaction(data, fileName) {
  const list = accounts();
  const selected = list.find(a => String(a.name).toLowerCase() === String(data.account || "").toLowerCase())?.id || list[0]?.id || "";
  const rawAmount = Number(data.amount);
  const type = data.type === "investment" ? "investment_buy" : (rawAmount < 0 ? "expense" : "income");
  const amount = moneyValue(rawAmount);
  const category = type === "investment_buy" ? "Inversiones" : type === "income" ? "Ingresos" : (data.description || "Otros");
  const cats = CATEGORIES.includes(category) ? category : "Otros";
  const root = document.getElementById("modal-root");
  if (!root) return;

  root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true">
    <header class="modal-head"><div><div class="section-kicker">Importación IA</div><h2>Revisar datos detectados</h2><p>${esc(fileName)} · confianza ${Math.round(Math.max(0, Math.min(1, Number(data.confidence) || 0)) * 100)}%</p></div><button type="button" class="icon-button modal-close" data-ai-close>×</button></header>
    <form id="movement-form"><div class="modal-body"><div class="form-grid">
      <div class="form-field full"><label>Concepto</label><input name="merchant" required value="${esc(data.description || data.institution || data.asset || "Importación IA")}"></div>
      <div class="form-field"><label>Tipo</label><select name="type"><option value="income"${type === "income" ? " selected" : ""}>Ingreso</option><option value="expense"${type === "expense" ? " selected" : ""}>Gasto</option><option value="investment_buy"${type === "investment_buy" ? " selected" : ""}>Aportación a inversión</option><option value="investment_sell">Venta de inversión</option><option value="transfer">Transferencia</option></select></div>
      <div class="form-field"><label>Importe</label><input name="amount" type="number" min=".01" step=".01" required value="${amount || ""}"></div>
      <div class="form-field"><label>Fecha</label><input name="date" type="date" value="${esc(data.date || today())}" required></div>
      <div class="form-field"><label>Cuenta origen</label><select name="accountId">${accountOptions(selected)}</select></div>
      <div class="form-field"><label>Cuenta destino</label><select name="destinationAccountId"><option value="">Sin destino</option>${accountOptions("")}</select></div>
      <div class="form-field"><label>Categoría</label><select name="category">${categoryOptions(cats)}</select></div>
      <div class="form-field full"><label>Nota</label><textarea name="description">Detectado por BorjaAI · ${esc(data.institution || "")}${data.ticker ? ` · ${esc(data.ticker)}` : ""}</textarea></div>
    </div><p class="form-hint">BorjaAI no guarda automáticamente la extracción: revisa los datos y confirma el movimiento.</p></div>
    <footer class="modal-foot"><button type="button" class="btn" data-ai-close>Cancelar</button><button class="btn btn-primary">Confirmar e incorporar</button></footer></form>
  </section></div>`;

  root.querySelectorAll("[data-ai-close]").forEach(b => b.addEventListener("click", close));
}

function openBalance(data, fileName) {
  const root = document.getElementById("modal-root");
  if (!root) return;
  root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true">
    <header class="modal-head"><div><div class="section-kicker">Importación IA</div><h2>Revisar saldo detectado</h2><p>${esc(fileName)} · revisa antes de incorporarlo.</p></div><button type="button" class="icon-button modal-close" data-ai-close>×</button></header>
    <form id="account-form"><div class="modal-body"><div class="form-grid">
      <div class="form-field"><label>Entidad</label><input name="name" required value="${esc(data.account || data.institution || "Cuenta importada")}"></div>
      <div class="form-field"><label>Tipo</label><select name="kind"><option value="bank">Cuenta bancaria</option><option value="cash">Efectivo</option><option value="broker">Broker</option></select></div>
      <div class="form-field full"><label>Saldo actual</label><input name="balance" type="number" min="0" step=".01" required value="${moneyValue(data.balance) || ""}"></div>
    </div><p class="form-hint">El saldo detectado es ${moneyValue(data.balance).toLocaleString("es-ES", { minimumFractionDigits: 2 })} ${esc(data.currency || "EUR")}.</p></div>
    <footer class="modal-foot"><button type="button" class="btn" data-ai-close>Cancelar</button><button class="btn btn-primary">Confirmar e incorporar</button></footer></form>
  </section></div>`;
  root.querySelectorAll("[data-ai-close]").forEach(b => b.addEventListener("click", close));
}

window.addEventListener("borjai:ai-import", event => {
  const payload = event.detail || {};
  const data = payload.data || {};
  if (data.type === "account_balance" && data.balance != null) openBalance(data, payload.fileName || "Importación IA");
  else openTransaction(data, payload.fileName || "Importación IA");
});

// If the user starts from the normal "Añadir información" flow and selects an image,
// route it directly to the AI importer instead of showing the old GitHub Pages fallback.
document.addEventListener("change", event => {
  const input = event.target;
  if (input?.id !== "file-input") return;
  const file = input.files?.[0];
  if (!file || !String(file.type || "").startsWith("image/")) return;
  if (window.BorjaAI?.openAiImportWithFile) {
    event.stopImmediatePropagation();
    window.BorjaAI.openAiImportWithFile(file);
  }
}, true);
