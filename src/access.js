const ACCESS_KEY = "BORJAI-2026";

const ACCESS_STORAGE_KEY = "borjai:access";

export function isAuthenticated(storage = localStorage) {
  return storage.getItem(ACCESS_STORAGE_KEY) === "ok";
}

export function authenticate(key, storage = localStorage) {
  if (key === ACCESS_KEY) {
    storage.setItem(ACCESS_STORAGE_KEY, "ok");
    return true;
  }

  return false;
}

export function logout(storage = localStorage) {
  storage.removeItem(ACCESS_STORAGE_KEY);
}
