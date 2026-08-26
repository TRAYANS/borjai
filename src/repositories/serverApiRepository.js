export function createServerApiRepository(options) {
  const baseUrl = options?.baseUrl || "";
  const getAccessToken = options?.getAccessToken || (async () => "");

  async function request(path, init = {}) {
    const token = await getAccessToken().catch(() => "");
    const response = await fetch(baseUrl + path, {
      ...init,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers || {})
      }
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.ok === false) {
      throw new Error(payload?.error || `API BorjaAI ${response.status}`);
    }
    return payload;
  }

  return {
    kind: "server-api",

    async load() {
      const payload = await request("/api/state");
      return payload.state;
    },

    async saveState(state) {
      const payload = await request("/api/state", {
        method: "PUT",
        body: JSON.stringify({ state })
      });
      return payload.state;
    },

    async reset() {
      const payload = await request("/api/state", {
        method: "DELETE"
      });
      return payload.state;
    },

    async migrateFromLocal(localState) {
      const payload = await request("/api/state/migrate", {
        method: "POST",
        body: JSON.stringify({ state: localState })
      });
      return payload;
    },

    async health() {
      return request("/api/state/health");
    }
  };
}
