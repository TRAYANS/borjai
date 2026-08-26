import { createConfiguredClient, loadRows, TABLES } from "../_stateCore.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    const context = createConfiguredClient(req);
    const rows = await loadRows(context);
    const counts = Object.fromEntries(TABLES.map((table) => [table, (rows[table] || []).length]));
    return res.status(200).json({
      ok: true,
      mode: context.mode,
      supabase: {
        configured: true,
        reachable: true,
        tables: TABLES.length
      },
      counts
    });
  } catch (error) {
    const message = error?.message || "Backend no disponible.";
    const status = /no está configurado|Sesión/.test(message) ? 503 : 500;
    return res.status(status).json({
      ok: false,
      mode: "unavailable",
      supabase: {
        configured: !/no está configurado/.test(message),
        reachable: false
      },
      error: message
    });
  }
}
