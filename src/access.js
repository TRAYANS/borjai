const ACCESS_STORAGE_KEY = "borjai:access";
const SUPABASE_SESSION_KEY = "borjai:supabase:session:v1";

function hasSupabaseSession(storage = localStorage) {
  try {
    const raw = storage.getItem(SUPABASE_SESSION_KEY);
    const session = raw ? JSON.parse(raw) : null;
    return Boolean(session?.access_token);
  } catch (_) {
    return false;
  }
}

// Authentication is handled by Supabase Auth. The legacy local flag is kept only
// for compatibility with older browser sessions.
export function isAuthenticated(storage = localStorage) {
  return hasSupabaseSession(storage) || storage.getItem(ACCESS_STORAGE_KEY) === "ok";
}

export function authenticate(_key, storage = localStorage) {
  return hasSupabaseSession(storage) || storage.getItem(ACCESS_STORAGE_KEY) === "ok";
}

export function logout(storage = localStorage) {
  storage.removeItem(ACCESS_STORAGE_KEY);
  storage.removeItem(SUPABASE_SESSION_KEY);
}
