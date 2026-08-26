export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  const configured = {
    openai: Boolean(process.env.OPENAI_API_KEY),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    groq: Boolean(process.env.GROQ_API_KEY)
  };
  const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

  res.setHeader("Cache-Control", "no-store, max-age=0");
  return res.status(200).json({
    supabaseUrl,
    supabaseAnonKey,
    backendMode: supabaseConfigured ? "supabase" : "local",
    supabaseConfigured,
    groqConfigured: configured.groq,
    aiCouncil: {
      enabled: Object.values(configured).some(Boolean),
      providers: configured,
      synthesis: configured.openai ? "openai" : configured.gemini ? "gemini" : configured.anthropic ? "anthropic" : configured.groq ? "groq" : null
    },
    version: "V.1.6.0"
  });
}
