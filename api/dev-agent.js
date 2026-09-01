const RATE = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 4;
const MAX_FILES = 6;
const MAX_CONTEXT_CHARS = 24_000;
const MAX_PATCHES = 12;
const MAX_FIND_CHARS = 8_000;
const MAX_FILE_CHARS = 120_000;
const REPO = process.env.GITHUB_REPO || "TRAYANS/borjai";
const BASE = "main";

function bearer(req) {
  const value = req.headers.authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

async function requireUser(req) {
  const token = bearer(req);
  if (!token) throw new Error("Sesión de BorjaAI no disponible.");
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  if (!url || !key) throw new Error("Supabase no está configurado.");
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: key, Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("Sesión de BorjaAI no válida.");
  return response.json();
}

function rateLimit(req) {
  const key = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const now = Date.now();
  const previous = RATE.get(key) || { at: now, count: 0 };
  if (now - previous.at >= WINDOW_MS) { RATE.set(key, { at: now, count: 1 }); return true; }
  if (previous.count >= MAX_REQUESTS) return false;
  previous.count += 1;
  RATE.set(key, previous);
  return true;
}

async function gh(path, options = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN no está configurado en Vercel.");
  const response = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    ...options,
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28", ...(options.headers || {}) }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || `GitHub error ${response.status}`);
  return payload;
}

async function listTree() {
  const data = await gh(`git/trees/${BASE}?recursive=1`);
  return (data.tree || []).filter((x) => x.type === "blob").map((x) => x.path).slice(0, 500);
}

async function readFile(path, ref = BASE) {
  const data = await gh(`contents/${encodeURIComponent(path).replace(/%2F/g, "/")}?ref=${encodeURIComponent(ref)}`);
  const text = Buffer.from(String(data.content || "").replace(/\n/g, ""), "base64").toString("utf8");
  return { path, sha: data.sha, content: text };
}

function modelList() {
  return [
    ["openai", process.env.OPENAI_API_KEY, process.env.OPENAI_COACH_MODEL || process.env.OPENAI_MODEL || "gpt-5.5"],
    ["anthropic", process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_COACH_MODEL || process.env.ANTHROPIC_MODEL || "claude-3-7-sonnet-latest"],
    ["gemini", process.env.GEMINI_API_KEY, process.env.GEMINI_COACH_MODEL || process.env.GEMINI_MODEL || "gemini-2.5-flash"],
    ["groq", process.env.GROQ_API_KEY, process.env.GROQ_COACH_MODEL || process.env.GROQ_MODEL || ""]
  ].filter((x) => x[1]);
}

async function resolveGroqModel(apiKey, preferred) {
  const response = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || "No se pudieron consultar los modelos de Groq.");
  const available = (payload.data || []).map((model) => model.id).filter(Boolean);
  if (preferred && available.includes(preferred)) return preferred;
  const candidates = ["qwen/qwen3.6-27b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
  return candidates.find((model) => available.includes(model)) || available.find((model) => /qwen|llama|gpt-oss/i.test(model)) || available[0] || "";
}

async function openAI(key, model, system, user, maxTokens) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model, input: [{ role: "system", content: [{ type: "input_text", text: system }] }, { role: "user", content: [{ type: "input_text", text: user }] }], max_output_tokens: maxTokens, store: false })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || "OpenAI no disponible.");
  return String(payload?.output_text || "").trim();
}

async function anthropic(key, model, system, user, maxTokens) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: "user", content: user }] })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || "Claude no disponible.");
  return (payload?.content || []).map((x) => x.text || "").join("\n").trim();
}

async function gemini(key, model, system, user, maxTokens) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: "user", parts: [{ text: user }] }], generationConfig: { responseMimeType: "application/json", maxOutputTokens: maxTokens } })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || "Gemini no disponible.");
  return payload?.candidates?.[0]?.content?.parts?.map((x) => x.text || "").join("\n").trim() || "";
}

async function groq(key, model, system, user, maxTokens) {
  const resolved = model || await resolveGroqModel(key, model);
  if (!resolved) throw new Error("Groq no tiene ningún modelo disponible para el agente.");
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: resolved, temperature: 0.1, max_completion_tokens: maxTokens, messages: [{ role: "system", content: system }, { role: "user", content: user }] })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error?.message || "Groq no disponible.");
  return payload?.choices?.[0]?.message?.content || "";
}

async function ask(provider, system, user, maxTokens) {
  const [name, key, model] = provider;
  if (name === "openai") return { provider: name, text: await openAI(key, model, system, user, maxTokens) };
  if (name === "anthropic") return { provider: name, text: await anthropic(key, model, system, user, maxTokens) };
  if (name === "gemini") return { provider: name, text: await gemini(key, model, system, user, maxTokens) };
  return { provider: name, text: await groq(key, model, system, user, maxTokens) };
}

function extractJson(text) {
  const cleaned = String(text || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  if (start < 0) throw new Error("No se encontró un objeto JSON en la respuesta de la IA.");
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if (inString) { if (escaped) escaped = false; else if (ch === "\\") escaped = true; else if (ch === '"') inString = false; continue; }
    if (ch === '"') { inString = true; continue; }
    if (ch === "{") depth += 1;
    if (ch === "}") { depth -= 1; if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1)); }
  }
  throw new Error("La respuesta JSON de la IA quedó incompleta.");
}

function isSafePath(path) {
  if (!path || path.startsWith("/") || path.includes("..") || path.includes("\\")) return false;
  if (/^(\.env|\.github\/workflows|vercel\.json$)/i.test(path)) return false;
  if (/^(src|api|test)\//.test(path)) return true;
  return /^(styles\.css|index\.html|package\.json)$/.test(path);
}

function trimContext(text, limit = MAX_CONTEXT_CHARS) {
  if (text.length <= limit) return text;
  const half = Math.max(1000, Math.floor(limit / 2));
  return `${text.slice(0, half)}\n\n...[CONTENIDO RECORTADO PARA EL ANALISIS]...\n\n${text.slice(-half)}`;
}

function applyPatch(content, patch) {
  const find = String(patch.find || "");
  const replace = String(patch.replace ?? "");
  if (!find) throw new Error(`Parche vacío para ${patch.path}.`);
  if (find.length > MAX_FIND_CHARS) throw new Error(`Parche demasiado grande para ${patch.path}.`);
  const first = content.indexOf(find);
  if (first < 0) throw new Error(`No se encontró el bloque indicado en ${patch.path}.`);
  const second = content.indexOf(find, first + find.length);
  if (second >= 0) throw new Error(`El bloque indicado aparece varias veces en ${patch.path}; usa un contexto más específico.`);
  return content.slice(0, first) + replace + content.slice(first + find.length);
}

function heuristicPlan(task, tree) {
  const lower = task.toLowerCase();
  const candidates = lower.includes("import") || lower.includes("csv") || lower.includes("imagen")
    ? ["src/ai-import.js", "src/file-import-v14.js", "app.js"]
    : lower.includes("coach") || lower.includes("convers") || lower.includes("chat")
      ? ["src/coach-v18.js", "src/coach-v18.css", "app.js", "api/coach-v18.js"]
      : lower.includes("error") || lower.includes("fallo") || lower.includes("bug") || lower.includes("revis")
        ? ["app.js", "api/dev-agent.js", "src/coach-v18.js", "src/ai-bridge.js"]
        : ["app.js", "src/coach-v18.js", "src/ai-bridge.js"];
  const files = candidates.filter((x) => tree.includes(x)).slice(0, 4);
  return { summary: "Revisión automática de la ruta más probable.", risks: [], files, tests: ["npm test"], implementationNotes: ["Revisar primero los archivos relevantes y aplicar solo cambios mínimos."] };
}

const PLANNER = `Eres el arquitecto principal de BorjaAI. Analiza una petición y el árbol del repositorio. Devuelve SOLO un JSON válido, sin markdown ni explicaciones: {"summary":"...","risks":[],"files":["ruta"],"tests":[],"implementationNotes":[]}. Elige como máximo 4 archivos realmente relevantes. Sé extremadamente conciso. Para una revisión general de errores, selecciona archivos de la aplicación y sus rutas críticas; no devuelvas un array vacío.`;
const CODER = `Eres el ingeniero principal de BorjaAI. Implementa la petición mediante parches pequeños sobre archivos existentes. Devuelve SOLO JSON válido, sin markdown: {"summary":"...","riskLevel":"low|medium|high","tests":[],"patches":[{"path":"ruta","action":"update","find":"texto exacto corto","replace":"texto nuevo"}],"notes":[]}. Usa únicamente bloques find copiados exactamente del código proporcionado. Máximo 12 parches. No reescribas archivos completos. No cambies secretos, autenticación, workflows ni infraestructura. Si la petición es una revisión y no hay un fallo que puedas corregir con seguridad, devuelve patches: [].`;

async function chooseProvider(providers, system, user, maxTokens) {
  let lastError;
  for (const provider of providers) {
    try {
      const result = await ask(provider, system, user, maxTokens);
      if (result?.text) return result;
    } catch (error) { lastError = error; }
  }
  throw new Error(lastError?.message || "Ningún proveedor IA respondió.");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!rateLimit(req)) return res.status(429).json({ error: "Demasiadas solicitudes. Espera un minuto." });
  try {
    await requireUser(req);
    const task = String((req.body || {}).task || "").trim();
    if (!task) return res.status(400).json({ error: "Describe qué quieres cambiar en BorjaAI." });
    if (task.length > 6000) return res.status(413).json({ error: "La petición es demasiado larga." });
    const providers = modelList();
    if (!providers.length) return res.status(503).json({ error: "No hay proveedores IA configurados." });
    const tree = await listTree();

    let plan;
    let planProvider = "heuristic";
    try {
      const planResult = await chooseProvider(providers, PLANNER, `PETICIÓN:\n${task}\n\nÁRBOL DEL REPOSITORIO:\n${tree.join("\n")}`, 650);
      plan = extractJson(planResult.text);
      planProvider = planResult.provider;
    } catch (_) {
      plan = heuristicPlan(task, tree);
    }

    const filePaths = Array.isArray(plan.files) ? plan.files.filter(isSafePath).filter((x) => tree.includes(x)).slice(0, MAX_FILES) : [];
    const finalPaths = filePaths.length ? filePaths : heuristicPlan(task, tree).files;
    if (!finalPaths.length) throw new Error("No se encontraron archivos seguros relacionados con esta petición.");

    const sourceFiles = [];
    let remaining = MAX_CONTEXT_CHARS;
    for (const path of finalPaths) {
      if (remaining <= 0) break;
      const file = await readFile(path);
      sourceFiles.push(file);
      remaining -= Math.min(file.content.length, remaining);
    }
    const contextFiles = sourceFiles.map((file) => ({ path: file.path, content: trimContext(file.content, Math.min(file.content.length, Math.max(1000, MAX_CONTEXT_CHARS / Math.max(1, sourceFiles.length)))) }));
    const coderUser = `PETICIÓN:\n${task}\n\nPLAN:\n${JSON.stringify(plan)}\n\nARCHIVOS ACTUALES:\n${contextFiles.map((f) => `\n--- ${f.path} ---\n${f.content}`).join("\n")}`;
    const firstProvider = providers.find((p) => p[0] === planProvider);
    const coderProviders = [firstProvider, ...providers].filter(Boolean).filter((p, i, arr) => arr.findIndex((x) => x[0] === p[0]) === i);
    const coded = await chooseProvider(coderProviders, CODER, coderUser, 1800);

    let patchSet;
    try { patchSet = extractJson(coded.text); }
    catch (_) { throw new Error("El agente de código no devolvió un paquete de cambios válido. Se ha evitado crear una rama incompleta; inténtalo de nuevo."); }
    const patches = Array.isArray(patchSet.patches) ? patchSet.patches.slice(0, MAX_PATCHES) : [];
    if (!patches.length) return res.status(200).json({ ok: true, changedFiles: [], summary: patchSet.summary || plan.summary || "Revisión completada sin cambios seguros que aplicar.", riskLevel: patchSet.riskLevel || "low", planProvider, coderProvider: coded.provider, noChanges: true });

    const byPath = new Map(sourceFiles.map((file) => [file.path, { ...file }]));
    for (const patch of patches) {
      if (!isSafePath(patch.path) || patch.action !== "update") throw new Error(`Parche no permitido para ${patch.path || "ruta desconocida"}.`);
      const file = byPath.get(patch.path);
      if (!file) throw new Error(`El agente intentó modificar ${patch.path}, pero ese archivo no fue incluido en el análisis.`);
      file.content = applyPatch(file.content, patch);
      if (file.content.length > MAX_FILE_CHARS) throw new Error(`El archivo ${patch.path} supera el límite seguro.`);
    }

    const refData = await gh(`git/ref/heads/${BASE}`);
    const mainSha = refData?.object?.sha;
    if (!mainSha) throw new Error("No se pudo resolver main en GitHub.");
    const slug = task.toLowerCase().replace(/[^a-z0-9áéíóúüñ]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 45) || "cambio";
    const branch = `ai/${Date.now()}-${slug}`;
    await gh("git/refs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: mainSha }) });

    const changedFiles = [];
    for (const file of byPath.values()) {
      const original = sourceFiles.find((x) => x.path === file.path);
      if (!original || original.content === file.content) continue;
      await gh(`contents/${encodeURIComponent(file.path).replace(/%2F/g, "/")}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: `ai: ${slug}`, content: Buffer.from(file.content, "utf8").toString("base64"), branch, sha: original.sha }) });
      changedFiles.push(file.path);
    }
    if (!changedFiles.length) return res.status(200).json({ ok: true, changedFiles: [], summary: patchSet.summary || "No había cambios que aplicar.", noChanges: true });

    const pr = await gh("pulls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: `AI: ${patchSet.summary || task.slice(0, 80)}`, head: branch, base: BASE, body: `## BorjaAI AI Developer\n\nPetición: ${task}\n\nRiesgo: ${patchSet.riskLevel || "unknown"}\n\nArchivos: ${changedFiles.join(", ")}\n\nTests propuestos:\n${(patchSet.tests || []).map((x) => `- ${x}`).join("\n")}\n\n**La IA no hace merge directo a main. Revisa el diff y el preview de Vercel antes de aprobar.**` }) });
    return res.status(200).json({ ok: true, branch, prUrl: pr.html_url, prNumber: pr.number, summary: patchSet.summary, riskLevel: patchSet.riskLevel, changedFiles, planProvider, coderProvider: coded.provider });
  } catch (error) {
    const message = error?.message || "No se pudo completar el cambio.";
    const status = /Sesión|Supabase/.test(message) ? 401 : 500;
    return res.status(status).json({ error: message });
  }
}
