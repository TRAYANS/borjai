import { createClient } from "@supabase/supabase-js";

const RATE = new Map();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 12;
const MAX_IMAGE_CHARS = 6_500_000;

function getBearer(req) {
  const value = req.headers.authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

async function requireUser(req) {
  const token = getBearer(req);
  if (!token) throw new Error("Sesión de BorjaAI no disponible.");
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  if (!url || !key) throw new Error("Supabase no está configurado.");
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const result = await supabase.auth.getUser(token);
  if (result.error || !result.data?.user) throw new Error("Sesión de BorjaAI no válida.");
  return result.data.user;
}

function rateLimit(req) {
  const key = String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const now = Date.now();
  const previous = RATE.get(key) || { at: now, count: 0 };
  if (now - previous.at >= WINDOW_MS) {
    RATE.set(key, { at: now, count: 1 });
    return true;
  }
  if (previous.count >= MAX_REQUESTS) return false;
  previous.count += 1;
  RATE.set(key, previous);
  return true;
}

function validateData(data) {
  const allowed = new Set(["account_balance", "transaction", "investment", "unknown", "transactions"]);
  if (!data || typeof data !== "object") throw new Error("La IA no devolvió un objeto.");
  if (!allowed.has(data.type)) throw new Error("Tipo de extracción no válido.");
  if (data.confidence != null && (!Number.isFinite(Number(data.confidence)) || Number(data.confidence) < 0 || Number(data.confidence) > 1)) {
    throw new Error("Confianza de extracción no válida.");
  }
  if (data.type === "transactions") {
    if (!Array.isArray(data.transactions) || data.transactions.length === 0 || data.transactions.length > 100) throw new Error("Lista de movimientos no válida.");
    data.transactions.forEach((t) => {
      if (!t || typeof t !== "object") throw new Error("Movimiento IA no válido.");
      if (t.amount != null && !Number.isFinite(Number(t.amount))) throw new Error("Importe IA no válido.");
    });
  }
  return data;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!rateLimit(req)) return res.status(429).json({ error: "Demasiadas solicitudes. Espera un minuto y vuelve a intentarlo." });
  try {
    await requireUser(req);
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(503).json({ error: "GROQ_API_KEY no configurada en Vercel." });

    const { image, mimeType = "image/jpeg" } = req.body || {};
    if (!image) return res.status(400).json({ error: "Falta la imagen." });
    if (String(image).length > MAX_IMAGE_CHARS) return res.status(413).json({ error: "La imagen es demasiado grande." });
    const allowedMime = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedMime.includes(mimeType)) return res.status(415).json({ error: "Formato no compatible. Usa JPG, PNG o WEBP." });

    const prompt = `You are a financial screenshot OCR extractor.
Read only information visibly present in the image. Never invent values.
Return exactly ONE valid JSON object and nothing else. No markdown.

Base object keys:
{"type":"unknown","institution":null,"account":null,"date":null,"description":null,"amount":null,"currency":"EUR","balance":null,"asset":null,"ticker":null,"quantity":null,"confidence":0}

Rules:
- type must be account_balance, transaction, investment, transactions, or unknown.
- If several clear transactions are visible, use type=transactions and add transactions:[{"date":null,"description":null,"amount":null,"currency":"EUR","account":null,"category":null}].
- Use null for anything not clearly visible.
- Numbers must be JSON numbers, not strings.
- confidence is 0 to 1.
- date uses YYYY-MM-DD only when clearly identifiable.
- The final response must be valid JSON.parse().`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.GROQ_VISION_MODEL || "qwen/qwen3.6-27b",
        temperature: 0,
        reasoning_effort: "none",
        reasoning_format: "hidden",
        max_completion_tokens: 1800,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${image}` } }
        ] }]
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      const detail = payload?.error?.message || payload?.error?.failed_generation || "Error de Groq.";
      return res.status(response.status).json({ error: detail });
    }
    const content = payload?.choices?.[0]?.message?.content;
    if (!content) return res.status(502).json({ error: "Groq no devolvió datos." });

    let data;
    try { data = JSON.parse(content); }
    catch (_) { return res.status(502).json({ error: "Groq devolvió una respuesta que no es JSON válido." }); }

    try { validateData(data); }
    catch (error) { return res.status(502).json({ error: error.message }); }

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    const status = error.message.includes("Sesión") || error.message.includes("Supabase") ? 401 : 500;
    return res.status(status).json({ error: error.message || "No se pudo analizar la imagen." });
  }
}
