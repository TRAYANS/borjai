const SESSION_KEY = "borjai:supabase:session:v1";

function readSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && parsed.access_token ? parsed : null;
  } catch (_) {
    return null;
  }
}

function writeSession(session) {
  try {
    if (session?.access_token) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch (_) {
    // Keep the in-memory session when storage is unavailable.
  }
}

function createQuery(baseUrl, anonKey, token, table) {
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${token || anonKey}`,
    Accept: "application/json"
  };

  return {
    select(columns = "*") {
      return {
        order(column = "created_at", options = {}) {
          const url = new URL(`/rest/v1/${table}`, baseUrl);
          url.searchParams.set("select", columns);
          url.searchParams.set("order", `${column}.${options.ascending === false ? "desc" : "asc"}`);
          return fetch(url, { headers, cache: "no-store" }).then(async (response) => {
            const data = await response.json().catch(() => []);
            if (!response.ok) throw new Error(data?.message || data?.error_description || `Supabase ${response.status}`);
            return { data: Array.isArray(data) ? data : [], error: null };
          });
        }
      };
    },

    upsert(rows, options = {}) {
      const url = new URL(`/rest/v1/${table}`, baseUrl);
      if (options.onConflict) url.searchParams.set("on_conflict", options.onConflict);
      return fetch(url, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates,return=minimal"
        },
        body: JSON.stringify(rows)
      }).then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) return { data: null, error: new Error(data?.message || data?.hint || data?.details || `Supabase ${response.status}`) };
        return { data, error: null };
      });
    },

    delete() {
      return {
        eq(column, value) {
          const url = new URL(`/rest/v1/${table}`, baseUrl);
          url.searchParams.set(column, `eq.${value}`);
          return fetch(url, {
            method: "DELETE",
            headers: {
              ...headers,
              Prefer: "return=minimal"
            }
          }).then(async (response) => {
            const data = await response.json().catch(() => null);
            if (!response.ok) return { data: null, error: new Error(data?.message || data?.hint || data?.details || `Supabase ${response.status}`) };
            return { data, error: null };
          });
        }
      };
    }
  };
}

async function authRequest(baseUrl, anonKey, path, options = {}) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    ...options,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.msg || data?.message || data?.error_description || `Supabase Auth ${response.status}`);
  return data;
}

export async function createSupabaseClient(config) {
  if (!config || !config.supabaseUrl || !config.supabaseAnonKey) return null;

  const baseUrl = String(config.supabaseUrl).replace(/\/$/, "");
  const anonKey = config.supabaseAnonKey;
  let session = readSession();

  async function ensureSession() {
    if (session?.access_token) {
      try {
        const response = await fetch(`${baseUrl}/auth/v1/user`, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${session.access_token}`
          },
          cache: "no-store"
        });
        if (response.ok) return session;
      } catch (_) {
        // Try a fresh anonymous session below.
      }
    }

    const created = await authRequest(baseUrl, anonKey, "/auth/v1/signup", {
      method: "POST",
      body: JSON.stringify({})
    });

    if (!created?.access_token || !created?.user) {
      throw new Error("Supabase no ha creado una sesión anónima. Activa Anonymous Sign-Ins en Supabase Auth.");
    }

    session = {
      access_token: created.access_token,
      refresh_token: created.refresh_token || null,
      expires_at: created.expires_at || null,
      user: created.user
    };
    writeSession(session);
    return session;
  }

  await ensureSession();

  return {
    auth: {
      async getSession() {
        const current = await ensureSession();
        return { data: { session: current }, error: null };
      },
      async signInAnonymously() {
        const created = await authRequest(baseUrl, anonKey, "/auth/v1/signup", {
          method: "POST",
          body: JSON.stringify({})
        });
        session = {
          access_token: created.access_token,
          refresh_token: created.refresh_token || null,
          expires_at: created.expires_at || null,
          user: created.user
        };
        writeSession(session);
        return { data: { user: created.user, session }, error: null };
      },
      async getUser() {
        const current = await ensureSession();
        const response = await fetch(`${baseUrl}/auth/v1/user`, {
          headers: {
            apikey: anonKey,
            Authorization: `Bearer ${current.access_token}`
          },
          cache: "no-store"
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return { data: { user: null }, error: new Error(data?.msg || data?.message || `Supabase Auth ${response.status}`) };
        session.user = data;
        writeSession(session);
        return { data: { user: data }, error: null };
      }
    },
    from(table) {
      return createQuery(baseUrl, anonKey, session?.access_token, table);
    }
  };
}
