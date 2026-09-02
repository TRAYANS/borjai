import { createClient } from "@supabase/supabase-js";
import { analyzeFinancialRisk } from "../src/financial-monitor.js";

const MONITOR_KEY = "borjai_monitor";

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.authorization === `Bearer ${secret}`;
}

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Faltan las credenciales server-side de Supabase.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  if (!authorized(req)) return res.status(401).json({ error: "Unauthorized" });

  try {
    const client = supabaseAdmin();
    const { data: users, error: usersError } = await client.auth.admin.listUsers({ perPage: 1000 });
    if (usersError) throw usersError;

    const results = [];
    for (const user of users || []) {
      const read = async table => {
        const result = await client.from(table).select("*").eq("user_id", user.id);
        if (result.error) throw result.error;
        return result.data || [];
      };
      const [transactions, accounts, assets, liabilities, investments, goals, snapshots] = await Promise.all([
        read("transactions"), read("accounts"), read("assets"), read("liabilities"),
        read("investments"), read("goals"), read("wealth_snapshots")
      ]);
      const data = { transactions, accounts, assets, liabilities, investments, goals, snapshots };
      const profile = user.user_metadata?.borjai_profile || {};
      const analysis = analyzeFinancialRisk(data, profile);
      const previous = user.user_metadata?.[MONITOR_KEY] || {};
      const critical = analysis.findings.filter(x => x.level === "critical").length;
      const warnings = analysis.findings.filter(x => x.level === "warn").length;
      const fingerprint = analysis.findings
        .filter(x => x.level === "critical")
        .map(x => `${x.kind}:${x.title}`).join("|") || analysis.findings
        .filter(x => x.level === "warn").slice(0, 2)
        .map(x => `${x.kind}:${x.title}`).join("|");

      const nextMonitor = {
        ...previous,
        lastServerCheckAt: analysis.generatedAt,
        lastServerFingerprint: fingerprint,
        serverCriticalCount: critical,
        serverWarningCount: warnings,
        serverFindings: analysis.findings.slice(0, 8),
        serverWeeklyReviewAt: analysis.generatedAt,
        serverNewAlert: Boolean(fingerprint && fingerprint !== (previous.lastServerFingerprint || "")),
      };

      const update = await client.auth.admin.updateUserById(user.id, {
        user_metadata: { ...(user.user_metadata || {}), [MONITOR_KEY]: nextMonitor },
      });
      if (update.error) throw update.error;
      results.push({ userId: user.id, critical, warnings, changed: nextMonitor.serverNewAlert });
    }

    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ ok: true, checkedAt: new Date().toISOString(), users: results.length, results });
  } catch (error) {
    console.error("Borjai financial monitor cron:", error);
    return res.status(500).json({ ok: false, error: error?.message || "No se pudo completar la revisión." });
  }
}
