export async function createSupabaseClient(config) {
  if (!config || !config.supabaseUrl || !config.supabaseAnonKey) return null;

  const mod = await import("https://esm.sh/@supabase/supabase-js@2");
  return mod.createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
}
