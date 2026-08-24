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

    const prompt = `Analiza esta captura financiera y extrae SOLO datos visibles y verificables. Tu tarea es convertir la captura en datos estructurados para una aplicación financiera personal.

Devuelve SOLO JSON valido con este formato exacto:
{
  "type": "account_balance|transaction|investment|unknown",
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

Reglas:
- No inventes datos.
- Usa null si un dato no aparece claramente.
- amount es el importe de la operacion, no el saldo.
- balance es el saldo visible de una cuenta.
- date debe ser YYYY-MM-DD cuando pueda determinarse con seguridad.
- confidence debe estar entre 0 y 1.
- Si aparecen varios datos pero no puedes determinar una unica operacion, usa type=unknown y conserva solo los campos inequívocos.`;

    // Para el importador de capturas usamos SIEMPRE el modelo multimodal
    // actualmente documentado por Groq. No permitimos que una variable de
    // entorno antigua seleccione Llama 4 Scout/Maverick y rompa la petición.
    // Qwen 3.6 27B admite imágenes y JSON mode.
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
      return res.status(response.status).json({ error: payload?.error?.message || "Error de Groq." });
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
