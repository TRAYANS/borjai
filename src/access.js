const ACCESS_STORAGE_KEY = "borjai:access";

// Legacy compatibility only. Authentication is now handled exclusively by Supabase Auth.
// No password or secret is stored in the frontend source code.
export function isAuthenticated(storage = localStorage) {
  return storage.getItem(ACCESS_STORAGE_KEY) === "ok";
}

export function authenticate(_key, storage = localStorage) {
  return storage.getItem(ACCESS_STORAGE_KEY) === "ok";
}

export function logout(storage = localStorage) {
  storage.removeItem(ACCESS_STORAGE_KEY);
}
