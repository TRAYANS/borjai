export async function createSupabaseClient(config) {
  if (!config || !config.supabaseUrl || !config.supabaseAnonKey) return null;

  // Use a stable browser ESM CDN. esm.sh intermittently fails in Safari/private
  // browsing and can make the whole financial API fall back to local storage.
  const mod = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");

  const client = mod.createClient(
    config.supabaseUrl,
    config.supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      },
      global: {
        headers: { "X-BorjaAI-Client": "1.4.1" }
      }
    }
  );

  const sessionResult = await client.auth.getSession();
  if (sessionResult.error) throw sessionResult.error;

  if (!sessionResult.data.session) {
    const anonymousResult = await client.auth.signInAnonymously();
    if (anonymousResult.error) throw anonymousResult.error;
  }

  return client;
}
