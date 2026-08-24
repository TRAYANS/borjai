const KEY = "borjai:mvp:v1";

const esc = (v) => String(v ?? "").replace(/[&<>\"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
const today = () => new Date().toISOString().slice(0,10);

async function token() {
  if (window.BORJAI_SESSION_TOKEN) return window.BORJAI_SESSION_TOKEN;
  const mod = await import("./db/supabaseClient.js");
  const cfg = await import("./config.js");
  const client = await mod.createSupabaseClient(await cfg.loadRuntimeConfig());
  const session = await client.auth.getSession();
  const value = session.data?.session?.access_token || "";
  if (value) window.BORJAI_SESSION_TOKEN = value;
  return value;
}

function csvLikeRows(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(v => String(v ?? "").trim().toLowerCase());
  const find = (...names) => headers.findIndex(h => names.some(n => h.includes(n)));
  const dateIndex = find("fecha","date");
  const descIndex = find("concepto","descripcion","description","merchant","comercio");
  const amountIndex = find("importe","amount","cantidad","movimiento","saldo");
  const out = [];
  for (let i=1;i<rows.length;i++) {
    const row = rows[i];
    const amount = amountIndex >= 0 ? Number(String(row[amountIndex] ?? "").replace(/\./g,"").replace(",",".")) : NaN;
    if (!Number.isFinite(amount) || !row[descIndex >= 0 ? descIndex : 0]) continue;
    out.push({ date: String(row[dateIndex] || today()).slice(0,10), description: String(row[descIndex >= 0 ? descIndex : 0]), amount, category:"Otros" });
  }
  return out;
}

async function handleXlsx(file) {
  const XLSX = await import("https://esm.sh/xlsx@0.18.5");
  const workbook = XLSX.read(await file.arrayBuffer(), { type:"array", cellDates:true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header:1, raw:false, defval:"" });
  const transactions = csvLikeRows(rows);
  if (!transactions.length) throw new Error("No se encontraron filas financieras reconocibles en el XLSX.");
  window.dispatchEvent(new CustomEvent("borjai:ai-import", { detail:{ data:{ type:"transactions", transactions, confidence:0.9 }, fileName:file.name } }));
}

async function imageFromPdf(page) {
  const viewport = page.getViewport({ scale: 1.65 });
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width); canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext("2d", { alpha:false });
  await page.render({ canvasContext:ctx, viewport }).promise;
  return canvas.toDataURL("image/jpeg",0.88).split(",")[1];
}

async function handlePdf(file) {
  const pdfjs = await import("https://esm.sh/pdfjs-dist@4.10.38/build/pdf.mjs");
  const pdf = await pdfjs.getDocument({ data:await file.arrayBuffer(), useWorkerFetch:false, isEvalSupported:true }).promise;
  const access = await token();
  if (!access) throw new Error("No hay sesión de Supabase para analizar el PDF.");
  const transactions = [];
  let single = null;
  const pages = Math.min(pdf.numPages, 5);
  for (let i=1;i<=pages;i++) {
    const page = await pdf.getPage(i);
    const image = await imageFromPdf(page);
    const response = await fetch("/api/ai", { method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${access}`}, body:JSON.stringify({ image, mimeType:"image/jpeg" }) });
    const payload = await response.json().catch(()=>({}));
    if (!response.ok) throw new Error(payload.error || `Error analizando página ${i}.`);
    const data = payload.data || {};
    if (data.type === "transactions" && Array.isArray(data.transactions)) transactions.push(...data.transactions);
    else if (data.type === "transaction" && data.amount != null) transactions.push(data);
    else if (!single && data.type === "account_balance") single = data;
  }
  if (transactions.length) window.dispatchEvent(new CustomEvent("borjai:ai-import", { detail:{ data:{type:"transactions",transactions,confidence:0.82}, fileName:file.name } }));
  else if (single) window.dispatchEvent(new CustomEvent("borjai:ai-import", { detail:{ data:single, fileName:file.name } }));
  else throw new Error("No se encontraron datos financieros claros en el PDF.");
}

function intercept() {
  document.addEventListener("change", async (event) => {
    const input = event.target;
    if (input?.id !== "file-input") return;
    const file = input.files?.[0];
    if (!file) return;
    const name = String(file.name || "").toLowerCase();
    const type = String(file.type || "").toLowerCase();
    const isPdf = type === "application/pdf" || name.endsWith(".pdf");
    const isXlsx = type.includes("spreadsheet") || type.includes("excel") || name.endsWith(".xlsx") || name.endsWith(".xls");
    if (!isPdf && !isXlsx) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      if (isXlsx) await handleXlsx(file); else await handlePdf(file);
    } catch (error) {
      const root = document.getElementById("modal-root");
      if (root) root.innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true"><header class="modal-head"><div><div class="section-kicker">Importación</div><h2>No se pudo leer el archivo</h2><p>${esc(error?.message || String(error))}</p></div></header><footer class="modal-foot"><button class="btn btn-primary" data-file-import-close>Cerrar</button></footer></section></div>`;
      root?.querySelector("[data-file-import-close]")?.addEventListener("click", () => root.replaceChildren());
    } finally { input.value = ""; }
  }, true);
}

intercept();
window.BORJAI_FILE_IMPORT_V14 = { handleXlsx, handlePdf };
