import { loadRuntimeConfig, hasSupabaseConfig, LOCAL_STORAGE_KEY, LOCAL_BACKUP_KEY, MIGRATION_STATUS_KEY } from "./config.js";
import { createSupabaseClient } from "./db/supabaseClient.js";

const RESET_KEY = "borjai:economic-reset:v2";
const TABLES = ["transactions", "accounts", "assets", "liabilities", "investments", "goals", "imports", "wealth_snapshots"];

export async function runOneTimeEconomicReset() {
  if (localStorage.getItem(RESET_KEY) === "done") return false;

  const config = await loadRuntimeConfig();
  if (!hasSupabaseConfig(config)) return false;

  const client = await createSupabaseClient(config);
  const { data, error } = await client.auth.getUser();
  if (error) throw error;
  const user = data?.user;
  if (!user) return false;

  for (const table of TABLES) {
    const result = await client.from(table).delete().eq("user_id", user.id);
    if (result.error) throw new Error(`No se pudo limpiar ${table}: ${result.error.message}`);
  }

  // Borra solo las copias económicas locales; conserva la sesión de Supabase y el acceso.
  localStorage.removeItem(LOCAL_STORAGE_KEY);
  localStorage.removeItem(LOCAL_BACKUP_KEY);
  localStorage.removeItem(MIGRATION_STATUS_KEY);
  localStorage.setItem(RESET_KEY, "done");
  return true;
}
