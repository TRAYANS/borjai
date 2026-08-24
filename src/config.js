export const LOCAL_STORAGE_KEY = "borjai:mvp:v1";
export const LOCAL_BACKUP_KEY = "borjai:mvp:v1:backup:v1.2";
export const MIGRATION_STATUS_KEY = "borjai:migration:v1.2:status";

export function readRuntimeConfig(source) {
  const runtime = source || globalThis.BORJAI_CONFIG || {};
  return {
    supabaseUrl: runtime.supabaseUrl || "",
    supabaseAnonKey: runtime.supabaseAnonKey || "",
    backendMode: runtime.backendMode || "auto"
  };
}

export async function loadRuntimeConfig(source) {
  const direct = readRuntimeConfig(source);
  if (direct.supabaseUrl && direct.supabaseAnonKey) return direct;

  try {
    const response = await fetch("/api/config", { cache: "no-store" });
    if (response.ok) {
      const remote = await response.json();
      return readRuntimeConfig(remote);
    }
  } catch (_) {
    // Keep local fallback when the runtime config endpoint is unavailable.
  }

  return direct;
}

export function hasSupabaseConfig(config) {
  return Boolean(config && config.supabaseUrl && config.supabaseAnonKey);
}
