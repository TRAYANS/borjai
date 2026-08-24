export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // V1.4 runtime configuration: secrets stay server-side in Vercel.
  // The public anon key is intentionally returned because Supabase uses it
  // as a client-side publishable key; the Groq key is never returned.
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  const groqConfigured = Boolean(process.env.GROQ_API_KEY);
  const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(200).json({
    supabaseUrl,
    supabaseAnonKey,
    backendMode: supabaseConfigured ? "supabase" : "local",
    supabaseConfigured,
    groqConfigured,
    version: "V.1.4"
  });
}
