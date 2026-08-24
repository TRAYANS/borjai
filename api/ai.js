export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "GROQ_API_KEY no configurada en variables de entorno." });
  }

  try {
    const { image, mimeType = "image/jpeg" } = req.body || {};
    if (!image) return res.status(400).json({ error: "Falta la imagen." });

    const prompt = `Analiza esta captura financiera y extrae SOLO datos visibles y verificables. Devuelve JSON valido con este formato exacto:
{
  "type": "account_balance|transaction|investment|unknown",
  "institution": "",
  "account": "",
  "date": "YYYY-MM-DD o null",
  "description": "",
  "amount": 0,
  "currency": "EUR",
  "balance": 0,
  "asset": "",
  "ticker": "",
  "quantity": 0,
  "confidence": 0
}
No inventes datos. Usa null cuando un campo no sea visible. confidence debe estar entre 0 y 1.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.GROQ_VISION_MODEL || "meta-llama/llama-4-scout-17b-16e-instruct",
        temperature: 0,
        max_tokens: 1000,
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
    if (!content) return res.status(502).json({ error: "Groq no devolvio datos." });

    const data = JSON.parse(content);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return res.status(500).json({ error: error.message || "No se pudo analizar la imagen." });
  }
}
