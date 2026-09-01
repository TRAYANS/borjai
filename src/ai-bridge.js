import { CATEGORIES } from "./importer.js";
import { createFinancialApi } from "./api/financialApi.js";

const KEY = "borjai:mvp:v1";
const esc = (v) => String(v ?? "").replace(/[&<>\"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "\"":"&quot;", "'":"&#039;" }[c]));
const moneyValue = (v) => Number.isFinite(Number(v)) ? Math.abs(Number(v)) : 0;
const euro = (v) => {
  const n = Number(v || 0);
  return new Intl.NumberFormat("es-ES", { style:"currency", currency:"EUR", minimumFractionDigits:2, maximumFractionDigits:2 }).format(n).replace(/\u00a0/g, " ");
};
const parseEuro = (v) => {
  const raw = String(v ?? "").trim().replace(/€/g, "").replace(/\s/g, "");
  if (!raw) return 0;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
};
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
      <div class="form-field"><label>Importe</label><input name="amount" type="text" inputmode="decimal" data-euro-input value="${esc(euro(amount))}" required></div>
      <div class="form-field"><label>Fecha</label><input name="date" type="date" value="${esc(data.date || today())}" required></div>
      <div class="form-field"><label>Cuenta origen</label><select name="accountId">${accountOptions(selected)}</select></div>
      <div class="form-field"><label>Categoría</label><select name="category">${categoryOptions(CATEGORIES.includes(category)?category:"Otros")}</select></div>
      <div class="form-field full"><label>Observaciones</label><textarea name="description">${esc(data.notes || `Detectado por BorjaAI · ${data.institution || ""}${data.ticker ? ` · ${data.ticker}` : ""}`)}</textarea></div>
    </div><p class="form-hint">Revisa los datos y confirma. Se sincronizan con Supabase.</p></div><footer class="modal-foot"><button type="button" class="btn" data-ai-close>Cancelar</button><button class="btn btn-primary">Confirmar e incorporar</button></footer></form></section></div>`;
  root.querySelectorAll("[data-ai-close]").forEach(b => b.addEventListener("click", close));
  setupEuroInput(root.querySelector("[data-euro-input]"), () => amount);
}

function openBalance(data, fileName) {
  const root = document.getElementById("modal-root"); if (!root) return;
  root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><header class="modal-head"><div><div class="section-kicker">Importación IA</div><h2>Revisar saldo detectado</h2><p>${esc(fileName)}</p></div><button type="button" class="icon-button modal-close" data-ai-close>×</button></header><form id="account-form"><div class="modal-body"><div class="form-grid"><div class="form-field"><label>Entidad</label><input name="name" required value="${esc(data.account || data.institution || "Cuenta importada")}"></div><div class="form-field"><label>Tipo</label><select name="kind"><option value="bank">Cuenta bancaria</option><option value="cash">Efectivo</option><option value="broker">Broker</option></select></div><div class="form-field full"><label>Saldo actual</label><input name="balance" type="text" inputmode="decimal" data-euro-input value="${esc(euro(moneyValue(data.balance)))}" required></div></div></div><footer class="modal-foot"><button type="button" class="btn" data-ai-close>Cancelar</button><button class="btn btn-primary">Confirmar e incorporar</button></footer></form></section></div>`;
  root.querySelectorAll("[data-ai-close]").forEach(b => b.addEventListener("click", close));
  setupEuroInput(root.querySelector("[data-euro-input]"));
}

function openBatch(data, fileName) {
  const rows = Array.isArray(data.transactions) ? data.transactions : [];
  if (!rows.length) return openSingle(data, fileName);
  const account = accounts()[0]?.id || "";
  const html = rows.map((row,i) => `<tr>
    <td><input data-ai-batch="${i}" data-field="date" type="date" value="${esc(row.date || today())}"></td>
    <td><input data-ai-batch="${i}" data-field="description" value="${esc(row.description || "Movimiento IA")}"></td>
    <td><input data-ai-batch="${i}" data-field="amount" type="text" inputmode="decimal" data-euro-input data-row-index="${i}" value="${esc(euro(Number(row.amount || 0)))}"></td>
    <td><select data-ai-batch="${i}" data-field="accountId">${accountOptions(row.accountId || account)}</select></td>
    <td><select data-ai-batch="${i}" data-field="category">${categoryOptions(row.category || "Otros")}</select></td>
    <td><input data-ai-batch="${i}" data-field="notes" placeholder="Añadir observación…" value="${esc(row.notes || "")}"></td>
  </tr>`).join("");
  rootWithBatch(data, fileName, rows, html);
}

function rootWithBatch(data, fileName, rows, html) {
  const root = document.getElementById("modal-root"); if (!root) return;
  root.innerHTML = `<div class="modal-backdrop"><section class="modal modal-wide" role="dialog" aria-modal="true">
    <header class="modal-head"><div><div class="section-kicker">Importación IA</div><h2>Revisar ${rows.length} movimientos</h2><p>${esc(fileName)} · revisa antes de confirmar.</p></div><button type="button" class="icon-button modal-close" data-ai-close>×</button></header>
    <div class="modal-body">
      <div class="table-shell"><table class="data-table"><thead><tr><th>Fecha</th><th>Concepto</th><th>Importe</th><th>Cuenta</th><th>Categoría</th><th>Observaciones</th></tr></thead><tbody>${html}</tbody></table></div>
      <section style="margin-top:18px;padding:16px;border:1px solid #292c33;border-radius:14px;background:#0d0f13"><div style="font-weight:700;margin-bottom:7px">Observaciones generales</div><div style="color:#9da3ad;font-size:13px;margin-bottom:10px">Cualquier detalle adicional sobre estos movimientos que quieras recordar.</div><textarea id="ai-general-notes" rows="3" placeholder="Escribe aquí tus observaciones generales…" style="width:100%;box-sizing:border-box;resize:vertical;background:#090a0d;color:#fff;border:1px solid #383c45;border-radius:10px;padding:12px"></textarea></section>
    </div>
    <footer class="modal-foot"><button type="button" class="btn" data-ai-close>Cancelar</button><button type="button" class="btn btn-primary" data-ai-batch-confirm>Confirmar ${rows.length} movimientos</button></footer>
  </section></div>`;
  root.querySelectorAll("[data-ai-close]").forEach(b => b.addEventListener("click", close));
  root.querySelectorAll("[data-euro-input]").forEach(input => setupEuroInput(input, () => {
    const index = Number(input.dataset.rowIndex);
    return rows[index]?.amount || 0;
  }));
  root.querySelector("[data-ai-batch-confirm]").addEventListener("click", () => confirmBatch(root, rows, data));
}

function setupEuroInput(input, getter) {
  if (!input) return;
  input.addEventListener("focus", () => {
    const n = parseEuro(input.value);
    input.value = Number.isFinite(n) ? String(n).replace(".", ",") : "";
    input.select();
  });
  input.addEventListener("blur", () => { input.value = euro(parseEuro(input.value)); });
}

async function persistState(mutator) {
  const local = readState();
  if (!local || local.version !== 1) throw new Error("No existe un estado financiero válido para incorporar la importación.");
  const api = await createFinancialApi({ localKey: KEY, fallbackFactory: () => local });
  const state = await api.load();
  await mutator(state);
  await api.saveState(state);
}

async function confirmBatch(root, rows, data) {
  const controls = root.querySelectorAll("[data-ai-batch]");
  const edits = rows.map((row,index) => {
    const out = { ...row };
    controls.forEach(input => { if (Number(input.dataset.aiBatch) === index) out[input.dataset.field] = input.dataset.field === "amount" ? parseEuro(input.value) : input.value; });
    return out;
  });
  const generalNotes = root.querySelector("#ai-general-notes")?.value.trim() || "";
  const button = root.querySelector("[data-ai-batch-confirm]");
  if (button) { button.disabled = true; button.textContent = "Guardando en Supabase…"; }
  try {
    await persistState(async (state) => {
      const accountMap = new Map((state.accounts || []).map(a => [a.id, a]));
      state.transactions = Array.isArray(state.transactions) ? state.transactions : [];
      const ids = [];
      edits.forEach(row => {
        const raw = Number(row.amount || 0);
        const type = raw < 0 ? "expense" : "income";
        const signed = type === "expense" ? -Math.abs(raw) : Math.abs(raw);
        const account = accountMap.get(row.accountId) || state.accounts?.[0];
        if (account) account.balance = Number(account.balance || 0) + signed;
        const id = `ai-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        state.transactions.push({ id, date:row.date||today(), merchant:row.description||"Movimiento IA", description:row.description||"Movimiento IA", amount:signed, type, category:type==="income"?"Ingresos":row.category||"Otros", accountId:account?.id||"", source:"ai", notes:row.notes||"" });
        ids.push(id);
      });
      state.imports = Array.isArray(state.imports) ? state.imports : [];
      state.imports.push({ id:`ai-import-${Date.now()}`, fileName:data?.fileName || "Importación IA", createdAt:today(), count:ids.length, ids, sourceType:"image", status:"confirmed", generalNotes });
    });
    close();
    window.location.reload();
  } catch (error) {
    if (button) { button.disabled = false; button.textContent = `Reintentar ${edits.length} movimientos`; }
    window.alert(error.message || "No se pudo guardar la importación en Supabase.");
  }
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
