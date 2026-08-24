import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  if (!url || !key) return res.status(200).json({ ok: false, stage: "config", error: "Supabase environment variables are missing" });
  try {
    const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    const auth = await supabase.auth.signInAnonymously();
    if (auth.error) return res.status(200).json({ ok: false, stage: "anonymous_auth", error: auth.error.message });
    const probe = await supabase.from("accounts").select("id").limit(1);
    if (probe.error) return res.status(200).json({ ok: false, stage: "database", error: probe.error.message, code: probe.error.code || null });
    return res.status(200).json({ ok: true, stage: "database", user: Boolean(auth.data?.user), accountsReadable: true });
  } catch (error) {
    return res.status(200).json({ ok: false, stage: "exception", error: error?.message || String(error) });
  }
}
