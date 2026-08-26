import { createConfiguredClient, emptyState, loadRows, replaceState, readBody } from "./_stateCore.js";
import { fromDatabaseRows } from "../src/repositories/stateMapper.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  try {
    const context = createConfiguredClient(req);

    if (req.method === "GET") {
      const state = fromDatabaseRows(await loadRows(context), emptyState);
      return res.status(200).json({ ok: true, mode: context.mode, state });
    }

    if (req.method === "PUT") {
      const body = await readBody(req);
      const state = await replaceState(context, body.state);
      return res.status(200).json({ ok: true, mode: context.mode, state });
    }

    if (req.method === "DELETE") {
      const state = await replaceState(context, emptyState());
      return res.status(200).json({ ok: true, mode: context.mode, state });
    }

    return res.status(405).json({ ok: false, error: "Method not allowed" });
  } catch (error) {
    const message = error?.message || "No se pudo acceder al estado financiero.";
    const status = /Supabase no está configurado/.test(message) ? 503 : /Sesión/.test(message) ? 401 : 500;
    return res.status(status).json({ ok: false, error: message });
  }
}
