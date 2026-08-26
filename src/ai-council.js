const SESSION_KEY = "borjai:supabase:session:v1";
const AUTH_KEY_HINT = "sb-";

export function readBorjaAISessionToken() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    if (session?.access_token) return session.access_token;
  } catch (_) {}
  if (window.BORJAI_SESSION_TOKEN) return window.BORJAI_SESSION_TOKEN;
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i) || "";
    if (!key.startsWith(AUTH_KEY_HINT) || !key.endsWith("-auth-token")) continue;
    try {
      const raw = JSON.parse(localStorage.getItem(key) || "null");
      const token = raw?.access_token || raw?.currentSession?.access_token || raw?.session?.access_token;
      if (token) return token;
    } catch (_) {}
  }
  return "";
}

// El flujo de Coach IA V1.8 se gestiona íntegramente en coach-v18.js.
// Este módulo conserva únicamente el lector de sesión por compatibilidad y no
// añade banners, listeners ni mensajes duplicados a la interfaz.
