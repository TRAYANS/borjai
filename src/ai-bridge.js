import { CATEGORIES } from "./importer.js";

const KEY = "borjai:mvp:v1";
const esc = (v) => String(v ?? "").replace(/[&<>\"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;" }[c]));
const moneyValue = (v) => Number.isFinite(Number(v)) ? Math.abs(Number(v)) : 0;
const today = () => new Date().toISOString().slice(0,10);
const readState = () => { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (_) { return null; } };
const accounts = () => { const s = readState(); return Array.isArray(s?.accounts) ? s.accounts : []; };
const accountOptions = (selected) => accounts().map(a => `<option value="${esc(a.id)}"${a.id===selected?" selected":""}>${esc(a.name)}</option>`).join("");
const categoryOptions = (selected) => CATEGORIES.map(c => `<option value="${esc(c)}"${c===selected?" selected":""}>${esc(c)}</option>`).join("");
const close = () => document.getElementById("modal-root")?.replaceChildren();

function openSingle(data, fileName) {
  const list = accounts();
  const selected = list.find(a => String(a.name).toLowerCase() === String(data.account || "").toLowerCase())?.id || list[0]?.id || "";
  const raw = Number(data.amount);
  const type = data.type === "investment" ? "investment_buy" : raw < 0 ? "expense" : "income";
  const amount = moneyValue(raw);
  const category = type === "investment_buy" ? "Inversiones" : type === "income" ? "Ingresos" : "Otros";
  const root = document.getElementById("modal-root"); if (!root) return;
  root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true">
    <header class="modal-head"><div><div class="section-kicker">Importación IA</div><h2>Revisar datos detectados</h2><p>${esc(fileName)} · confianza ${Math.round(Math.max(0,Math.min(1,Number(data.confidence)||0))*100)}%</p></div><button type="button" class="icon-button modal-close" data-ai-close>×</button></header>
    <form id="movement-form"><div class="modal-body"><div class="form-grid">
      <div class="form-field full"><label>Concepto</label><input name="merchant" required value="${esc(data.description || data.institution || data.asset || "Importación IA")}"></div>
      <div class="form-field"><label>Tipo</label><select name="type"><option value="income"${type==="income"?" selected":""}>Ingreso</option><option value="expense"${type==="expense"?" selected":""}>Gasto</option><option value="investment_buy"${type==="investment_buy"?" selected":""}>Aportación a inversión</option><option value="investment_sell">Venta de inversión</option></select></div>
      <div class="form-field"><label>Importe</label><input name="amount" type="number" min=".01" step=".01" required value="${amount || ""}"></div>
      <div class="form-field"><label>Fecha</label><input name="date" type="date" value="${esc(data.date || today())}" required></div>
      <div class="form-field"><label>Cuenta origen</label><select name="accountId">${accountOptions(selected)}</select></div>
      <div class="form-field"><label>Categoría</label><select name="category">${categoryOptions(CATEGORIES.includes(category)?category:"Otros")}</select></div>
      <div class="form-field full"><label>Nota</label><textarea name="description">Detectado por BorjaAI · ${esc(data.institution || "")}${data.ticker ? ` · ${esc(data.ticker)}` : ""}</textarea></div>
    </div><p class="form-hint">Revisa los datos y confirma. Se sincronizan con Supabase.</p></div><footer class="modal-foot"><button type="button" class="btn" data-ai-close>Cancelar</button><button class="btn btn-primary">Confirmar e incorporar</button></footer></form></section></div>`;
  root.querySelectorAll("[data-ai-close]").forEach(b => b.addEventListener("click", close));
}

function openBalance(data, fileName) {
  const root = document.getElementById("modal-root"); if (!root) return;
  root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><header class="modal-head"><div><div class="section-kicker">Importación IA</div><h2>Revisar saldo detectado</h2><p>${esc(fileName)}</p></div><button type="button" class="icon-button modal-close" data-ai-close>×</button></header><form id="account-form"><div class="modal-body"><div class="form-grid"><div class="form-field"><label>Entidad</label><input name="name" required value="${esc(data.account || data.institution || "Cuenta importada")}"></div><div class="form-field"><label>Tipo</label><select name="kind"><option value="bank">Cuenta bancaria</option><option value="cash">Efectivo</option><option value="broker">Broker</option></select></div><div class="form-field full"><label>Saldo actual</label><input name="balance" type="number" min="0" step=".01" required value="${moneyValue(data.balance) || ""}"></div></div></div><footer class="modal-foot"><button type="button" class="btn" data-ai-close>Cancelar</button><button class="btn btn-primary">Confirmar e incorporar</button></footer></form></section></div>`;
  root.querySelectorAll("[data-ai-close]").forEach(b => b.addEventListener("click", close));
}

function openBatch(data, fileName) {
  const rows = Array.isArray(data.transactions) ? data.transactions : [];
  if (!rows.length) return openSingle(data, fileName);
  const root = document.getElementById("modal-root"); if (!root) return;
  const account = accounts()[0]?.id || "";
  const html = rows.map((row,i) => `<tr><td><input data-ai-batch="${i}" data-field="date" type="date" value="${esc(row.date || today())}"></td><td><input data-ai-batch="${i}" data-field="description" value="${esc(row.description || "Movimiento IA")}"></td><td><input data-ai-batch="${i}" data-field="amount" type="number" step="0.01" value="${Number(row.amount || 0)}"></td><td><select data-ai-batch="${i}" data-field="accountId">${accountOptions(account)}</select></td><td><select data-ai-batch="${i}" data-field="category">${categoryOptions(row.category || "Otros")}</select></td></tr>`).join("");
  root.innerHTML = `<div class="modal-backdrop"><section class="modal modal-wide" role="dialog" aria-modal="true"><header class="modal-head"><div><div class="section-kicker">Importación IA</div><h2>Revisar ${rows.length} movimientos</h2><p>${esc(fileName)} · revisa antes de confirmar.</p></div><button type="button" class="icon-button modal-close" data-ai-close>×</button></header><div class="modal-body"><div class="table-shell"><table class="data-table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Importe</th><th>Cuenta</th><th>Categoría</th></tr></thead><tbody>${html}</tbody></table></div></div><footer class="modal-foot"><button type="button" class="btn" data-ai-close>Cancelar</button><button type="button" class="btn btn-primary" data-ai-batch-confirm>Confirmar ${rows.length} movimientos</button></footer></section></div>`;
  root.querySelectorAll("[data-ai-close]").forEach(b => b.addEventListener("click", close));
  root.querySelector("[data-ai-batch-confirm]").addEventListener("click", () => confirmBatch(root, rows));
}

function confirmBatch(root, rows) {
  const state = readState();
  if (!state || state.version !== 1) return;
  const accountMap = new Map((state.accounts || []).map(a => [a.id, a]));
  const controls = root.querySelectorAll("[data-ai-batch]");
  const edits = rows.map((row,index) => {
    const out = { ...row };
    controls.forEach(input => { if (Number(input.dataset.aiBatch) === index) out[input.dataset.field] = input.value; });
    return out;
  });
  state.transactions = Array.isArray(state.transactions) ? state.transactions : [];
  edits.forEach(row => {
    const raw = Number(row.amount || 0);
    const type = raw < 0 ? "expense" : "income";
    const signed = type === "expense" ? -Math.abs(raw) : Math.abs(raw);
    const account = accountMap.get(row.accountId) || state.accounts?.[0];
    if (account) account.balance = Number(account.balance || 0) + signed;
    state.transactions.push({ id:`ai-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, date:row.date||today(), merchant:row.description||"Movimiento IA", description:row.description||"Movimiento IA", amount:signed, type, category:type==="income"?"Ingresos":row.category||"Otros", accountId:account?.id||"", source:"ai" });
  });
  localStorage.setItem(KEY, JSON.stringify(state));
  close();
  window.location.reload();
}

window.addEventListener("borjai:ai-import", event => {
  const data = event.detail?.data || {};
  const fileName = event.detail?.fileName || "Importación IA";
  if (data.type === "account_balance" && data.balance != null) openBalance(data,fileName);
  else if (data.type === "transactions") openBatch(data,fileName);
  else openSingle(data,fileName);
});

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
