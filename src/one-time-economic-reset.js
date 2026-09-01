import { loadRuntimeConfig, hasSupabaseConfig } from "./config.js";
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

  // Elimina cualquier copia local antigua para que no pueda resucitar datos borrados.
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) keys.push(localStorage.key(i));
  keys.filter((key) => key && (key.startsWith("borjai:") || key.includes("borjai")))
    .forEach((key) => localStorage.removeItem(key));

  localStorage.setItem(RESET_KEY, "done");
  return true;
}
