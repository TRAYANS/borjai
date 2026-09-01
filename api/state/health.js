export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  res.setHeader("Cache-Control", "no-store, max-age=0");

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  if (!url || !key) {
    return res.status(503).json({
      ok: false,
      mode: "unavailable",
      supabase: { configured: false, reachable: false },
      error: "Supabase no está configurado."
    });
  }

  try {
    const root = String(url).replace(/\/$/, "");
    const response = await fetch(`${root}/auth/v1/settings`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      cache: "no-store"
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(503).json({
        ok: false,
        mode: "unavailable",
        supabase: { configured: true, reachable: false },
        error: data?.message || data?.msg || `Supabase HTTP ${response.status}`
      });
    }

    return res.status(200).json({
      ok: true,
      mode: process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.BORJAI_OWNER_ID ? "service_role_owner" : "rls_user",
      supabase: { configured: true, reachable: true }
    });
  } catch (error) {
    return res.status(503).json({
      ok: false,
      mode: "unavailable",
      supabase: { configured: true, reachable: false },
      error: error?.message || "No se pudo conectar con Supabase."
    });
  }
}
