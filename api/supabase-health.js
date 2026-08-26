const TABLES = ["accounts","categories","transactions","assets","liabilities","investments","goals","imports","wealth_snapshots"];

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ ok:false, error:"Method not allowed" });
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  if (!url || !key) return res.status(503).json({ ok:false, stage:"config", error:"Supabase environment variables are missing" });
  try {
    const root = String(url).replace(/\/$/, "");
    const authResponse = await fetch(`${root}/auth/v1/signup`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({}),
      cache: "no-store"
    });
    const auth = await authResponse.json().catch(() => ({}));
    if (!authResponse.ok) return res.status(503).json({ok:false,stage:"anonymous_auth",error:auth?.msg || auth?.message || "Anonymous auth failed"});
    const token = auth.access_token;
    const tables = {};
    for (const table of TABLES) {
      const probe = await fetch(`${root}/rest/v1/${table}?select=id&limit=1`, {
        headers: { apikey: key, Authorization: `Bearer ${token}` },
        cache: "no-store"
      });
      const data = await probe.json().catch(() => ({}));
      tables[table] = probe.ok ? {ok:true} : {ok:false,error:data?.message || `HTTP ${probe.status}`,code:data?.code||null};
    }
    const failed = Object.entries(tables).filter(([,v]) => !v.ok).map(([name]) => name);
    return res.status(failed.length ? 500 : 200).json({ ok:failed.length===0, stage:"database", user:Boolean(auth.user), tables, failed });
  } catch (error) {
    return res.status(500).json({ok:false,stage:"exception",error:error?.message||String(error)});
  }
}
