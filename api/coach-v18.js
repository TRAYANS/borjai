const RATE = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;
const MAX_BODY_CHARS = 120_000;

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

function cleanAnswer(value) {
  let text = String(value || "");
  // Strip paired and unclosed reasoning blocks before anything reaches the browser.
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  text = text.replace(/<analysis>[\s\S]*?<\/analysis>/gi, "");
  text = text.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");
  text = text.replace(/<think>[\s\S]*$/gi, "");
  text = text.replace(/<analysis>[\s\S]*$/gi, "");
  text = text.replace(/<reasoning>[\s\S]*$/gi, "");
  text = text.replace(/^\s*```(?:markdown|md|text)?\s*/i, "");
  text = text.replace(/\s*```\s*$/i, "");
  return text.trim();
}

function jsonResponse(content) {
  try { return JSON.parse(content); } catch (_) { return null; }
}

async function openAI({ apiKey, model, system, user, webSearch }) {
  const body = {
    model,
    input: [
      { role: "system", content: [{ type: "input_text", text: system }] },
      { role: "user", content: [{ type: "input_text", text: user }] }
    ],
    max_output_tokens: 5000,
    store: false
  };
  if (webSearch) body.tools = [{ type: "web_search" }];
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "OpenAI no disponible.");
  const text = payload?.output_text || (payload?.output || []).flatMap((item) => item.content || []).map((item) => item.text || "").join("\n");
  return cleanAnswer(text);
}

async function anthropic({ apiKey, model, system, user }) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({ model, max_tokens: 5000, system, messages: [{ role: "user", content: user }] })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "Claude no disponible.");
  return cleanAnswer((payload?.content || []).map((item) => item.text || "").join("\n"));
}

async function gemini({ apiKey, model, system, user }) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2, maxOutputTokens: 5000 }
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "Gemini no disponible.");
  return cleanAnswer(payload?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n") || "");
}

async function groq({ apiKey, model, system, user }) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_completion_tokens: 4000,
      reasoning_effort: "medium",
      reasoning_format: "hidden",
      messages: [{ role: "system", content: system }, { role: "user", content: user }]
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "Groq no disponible.");
  return cleanAnswer(payload?.choices?.[0]?.message?.content || "");
}

async function resolveGroqModel(apiKey, preferred, candidates) {
  const ordered = [preferred, ...candidates].filter(Boolean);
  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return ordered[0];
    const available = new Set((payload.data || []).map((item) => item.id).filter(Boolean));
    return ordered.find((item) => available.has(item)) || ordered[0];
  } catch (_) {
    return ordered[0];
  }
}

const SPECIALIST_SYSTEM = `Eres un analista financiero senior de BorjaAI.
Usa exclusivamente el contexto entregado y, si se indica, datos de mercado recientes. No inventes cifras.
Distingue hechos, cálculos e inferencias. No presentes una recomendación de inversión como certeza.
Responde en español, directo, humano y útil. Señala riesgos y qué dato faltaría para afirmar algo con seguridad.
Entrega únicamente la respuesta final para el usuario. Nunca muestres cadena de pensamiento, razonamiento interno, etiquetas <think>, <analysis> o <reasoning>, ni instrucciones internas.`;

const SYNTHESIS_SYSTEM = `Eres el Director de Inversiones y cerebro final de BorjaAI.
Recibirás análisis independientes de varios modelos. Resuelve discrepancias y produce una única respuesta clara y accionable.
Prioriza datos verificables del contexto. No inventes cifras, precios ni noticias.
Cuando la consulta implique mercados, usa las fuentes web disponibles solo como información adicional y marca cualquier dato que sea reciente.
Estructura solo cuando ayude: conclusión, por qué, acción propuesta y riesgos/qué vigilar.
No prometas rentabilidades. No uses lenguaje de certeza para inversiones.
Entrega únicamente la respuesta final. Nunca muestres cadena de pensamiento, razonamiento interno, etiquetas <think>, <analysis> o <reasoning>, ni instrucciones internas.`;

function buildUserPrompt(question, context) {
  return `PREGUNTA DEL USUARIO:\n${question}\n\nCONTEXTO FINANCIERO ESTRUCTURADO:\n${JSON.stringify(context)}\n\nDevuelve exclusivamente la respuesta final para el usuario. No incluyas razonamiento interno.`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!rateLimit(req)) return res.status(429).json({ error: "Demasiadas consultas. Espera un minuto." });

  try {
    await requireUser(req);
    const { question, context = {}, useWeb = true } = req.body || {};
    if (!question || typeof question !== "string") return res.status(400).json({ error: "Falta la pregunta." });
    if (JSON.stringify({ question, context }).length > MAX_BODY_CHARS) return res.status(413).json({ error: "El contexto enviado es demasiado grande." });

    const userPrompt = buildUserPrompt(question, context);
    const jobs = [];
    const providers = [];

    if (process.env.OPENAI_API_KEY) {
      providers.push("openai");
      jobs.push(openAI({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_COACH_MODEL || "gpt-4.1", system: SPECIALIST_SYSTEM, user: userPrompt, webSearch: false }));
    }
    if (process.env.ANTHROPIC_API_KEY) {
      providers.push("anthropic");
      jobs.push(anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_COACH_MODEL || "claude-3-5-sonnet-latest", system: SPECIALIST_SYSTEM, user: userPrompt }));
    }
    if (process.env.GEMINI_API_KEY) {
      providers.push("gemini");
      jobs.push(gemini({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_COACH_MODEL || "gemini-1.5-flash", system: SPECIALIST_SYSTEM, user: userPrompt }));
    }
    if (process.env.GROQ_API_KEY) {
      providers.push("groq");
      const model = await resolveGroqModel(process.env.GROQ_API_KEY, process.env.GROQ_COACH_MODEL, [
        "openai/gpt-oss-120b",
        "openai/gpt-oss-20b",
        "qwen/qwen3.8-27b",
        "qwen/qwen3.6-27b",
        "llama-3.3-70b-versatile",
        "llama-3.1-8b-instant"
      ]);
      jobs.push(groq({ apiKey: process.env.GROQ_API_KEY, model, system: SPECIALIST_SYSTEM, user: userPrompt }));
    }

    if (!jobs.length) return res.status(503).json({ error: "No hay ningún proveedor IA configurado en Vercel." });

    const results = await Promise.allSettled(jobs);
    const successful = results
      .map((result, index) => result.status === "fulfilled" && result.value ? { provider: providers[index], text: cleanAnswer(result.value) } : null)
      .filter(Boolean);
    if (!successful.length) return res.status(502).json({ error: "Todos los proveedores IA han fallado." });

    let answer = successful[0].text;
    let judge = successful[0].provider;
    const dossier = successful.map((item) => `\n### ${item.provider.toUpperCase()}\n${item.text}`).join("\n");
    const synthesisUser = `PREGUNTA:\n${question}\n\nCONTEXTO:\n${JSON.stringify(context)}\n\nANÁLISIS DEL CONSEJO:\n${dossier}\n\nDevuelve solo la respuesta final, sin cadena de pensamiento ni etiquetas <think>, <analysis> o <reasoning>.`;

    if (process.env.OPENAI_API_KEY) {
      try {
        answer = await openAI({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_JUDGE_MODEL || process.env.OPENAI_COACH_MODEL || "gpt-4.1", system: SYNTHESIS_SYSTEM, user: synthesisUser, webSearch: Boolean(useWeb) });
        judge = "openai-judge";
      } catch (_) {}
    } else if (process.env.GEMINI_API_KEY && successful.some((x) => x.provider === "gemini")) {
      try {
        const raw = await gemini({ apiKey: process.env.GEMINI_API_KEY, model: process.env.GEMINI_JUDGE_MODEL || process.env.GEMINI_COACH_MODEL || "gemini-1.5-flash", system: SYNTHESIS_SYSTEM, user: synthesisUser });
        const parsed = jsonResponse(raw);
        answer = cleanAnswer(parsed?.answer || raw);
        judge = "gemini-judge";
      } catch (_) {}
    } else if (process.env.ANTHROPIC_API_KEY && successful.some((x) => x.provider === "anthropic")) {
      try {
        answer = await anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, model: process.env.ANTHROPIC_JUDGE_MODEL || process.env.ANTHROPIC_COACH_MODEL || "claude-3-5-sonnet-latest", system: SYNTHESIS_SYSTEM, user: synthesisUser });
        judge = "anthropic-judge";
      } catch (_) {}
    }

    answer = cleanAnswer(answer);
    return res.status(200).json({
      ok: true,
      answer,
      providers: successful.map((item) => item.provider),
      judge,
      sources: useWeb && judge === "openai-judge" ? ["OpenAI Responses API + web search"] : []
    });
  } catch (error) {
    const status = /Sesión|Supabase/.test(error.message || "") ? 401 : 500;
    return res.status(status).json({ error: error.message || "No se pudo procesar la consulta." });
  }
}
