import { createConfiguredClient, loadRows, TABLES } from "../_stateCore.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    const context = createConfiguredClient(req);
    const rows = await loadRows(context);
    const counts = Object.fromEntries(TABLES.map((table) => [table, (rows[table] || []).length]));
    return res.status(200).json({ ok: true, mode: context.mode, counts });
  } catch (error) {
    return res.status(200).json({ ok: false, error: error?.message || "Backend no disponible." });
  }
}
