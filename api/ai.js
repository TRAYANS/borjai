export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "GROQ_API_KEY no configurada en Vercel. Añade la variable en Production y vuelve a desplegar."
    });
  }

  try {
    const { image, mimeType = "image/jpeg" } = req.body || {};
    if (!image) return res.status(400).json({ error: "Falta la imagen." });

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(mimeType)) {
      return res.status(415).json({ error: "Formato no compatible. La imagen debe llegar como JPG, PNG o WEBP." });
    }

    const prompt = `You are a financial screenshot OCR extractor.
Read only information that is visibly present in the image. Never invent values.
Return exactly ONE valid JSON object and nothing else. No markdown. No code fences. No explanation.

Use exactly these keys:
{
  "type": "account_balance",
  "institution": null,
  "account": null,
  "date": null,
  "description": null,
  "amount": null,
  "currency": "EUR",
  "balance": null,
  "asset": null,
  "ticker": null,
  "quantity": null,
  "confidence": 0
}

Rules:
- type must be exactly one of: account_balance, transaction, investment, unknown.
- Use null when a value is not clearly visible.
- amount is the transaction/operation amount.
- balance is the visible account or portfolio balance.
- date must be YYYY-MM-DD only when it is clearly identifiable.
- currency should be the visible currency; use EUR only when the image clearly indicates euros or when no other currency is shown.
- confidence is a number from 0 to 1.
- Keep numbers as JSON numbers, not strings.
- If several transactions are visible and one object cannot represent them reliably, use type unknown and keep only the unambiguous account-level information.
- The final response must be parseable by JSON.parse().`;

    const visionModel = "qwen/qwen3.6-27b";

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: visionModel,
        temperature: 0,
        reasoning_effort: "none",
        reasoning_format: "hidden",
        max_completion_tokens: 1000,
        response_format: { type: "json_object" },
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${image}` } }
          ]
        }]
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
    try {
      data = JSON.parse(content);
    } catch (_) {
      return res.status(502).json({ error: "Groq devolvió una respuesta que no es JSON válido." });
    }

    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ error: error.message || "No se pudo analizar la imagen." });
  }
}
