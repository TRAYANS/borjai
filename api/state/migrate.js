import { createConfiguredClient, migrateState, readBody } from "../_stateCore.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    const context = createConfiguredClient(req);
    const body = await readBody(req);
    const result = await migrateState(context, body.state);
    return res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    return res.status(500).json({ ok: false, error: error?.message || "No se pudo migrar." });
  }
}
