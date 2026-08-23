export async function createSupabaseClient(config) {
  if (!config || !config.supabaseUrl || !config.supabaseAnonKey) return null;

  const mod = await import("https://esm.sh/@supabase/supabase-js@2");

  const client = mod.createClient(
    config.supabaseUrl,
    config.supabaseAnonKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false
      }
    }
  );

  const sessionResult = await client.auth.getSession();

  if (sessionResult.error) {
    throw sessionResult.error;
  }

  if (!sessionResult.data.session) {
    const anonymousResult = await client.auth.signInAnonymously();

    if (anonymousResult.error) {
      throw anonymousResult.error;
    }
  }

  return client;
}
