import {
  fromDatabaseRows,
  normalizeState,
  stateCounts,
  toDatabaseRows,
  validateLegacyState
} from "../src/repositories/stateMapper.js";

const TABLES = ["accounts", "categories", "transactions", "assets", "liabilities", "investments", "goals", "imports", "wealth_snapshots"];
const CONFLICT_KEYS = { accounts: "user_id,legacy_id", categories: "user_id,name,type", transactions: "user_id,legacy_id", assets: "user_id,legacy_id", liabilities: "user_id,legacy_id", investments: "user_id,legacy_id", goals: "user_id,legacy_id", imports: "user_id,legacy_id", wealth_snapshots: "user_id,legacy_id" };

function queryError(data, status) { return new Error(data?.message || data?.error_description || data?.hint || data?.details || `Supabase ${status}`); }
function quoteIn(values) { return `in.(${(values || []).filter((value) => value != null).map((value) => String(value).replaceAll('"', '\\"')).join(",")})`; }

function createRestClient(baseUrl, apiKey, bearerToken) {
  const root = String(baseUrl || "").replace(/\/$/, "");
  const headers = { apikey: apiKey, Authorization: `Bearer ${bearerToken || apiKey}`, Accept: "application/json" };
  return {
    from(table) {
      return {
        select(columns = "*") {
          const state = { columns, filters: [], order: "" };
          const chain = {
            eq(column, value) { state.filters.push([column, `eq.${value}`]); return chain; },
            in(column, values) { if (Array.isArray(values) && values.length) state.filters.push([column, quoteIn(values)]); return chain; },
            order(column = "created_at", options = {}) {
              state.order = `${column}.${options.ascending === false ? "desc" : "asc"}`;
              const url = new URL(`/rest/v1/${table}`, root);
              url.searchParams.set("select", state.columns);
              state.filters.forEach(([key, value]) => url.searchParams.set(key, value));
              if (state.order) url.searchParams.set("order", state.order);
              return fetch(url, { headers, cache: "no-store" }).then(async (response) => {
                const data = await response.json().catch(() => []);
                if (!response.ok) return { data: null, error: queryError(data, response.status) };
                return { data: Array.isArray(data) ? data : [], error: null };
              });
            }
          };
          return chain;
        },
        upsert(rows, options = {}) {
          const url = new URL(`/rest/v1/${table}`, root);
          if (options.onConflict) url.searchParams.set("on_conflict", options.onConflict);
          return fetch(url, { method: "POST", headers: { ...headers, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows || []), cache: "no-store" }).then(async (response) => {
            const data = await response.json().catch(() => null);
            if (!response.ok) return { data: null, error: queryError(data, response.status) };
            return { data, error: null };
          });
        },
        delete() {
          const state = { filters: [] };
          const chain = {
            eq(column, value) { state.filters.push([column, `eq.${value}`]); return chain; },
            in(column, values) { if (Array.isArray(values) && values.length) state.filters.push([column, quoteIn(values)]); return chain; },
            then(resolve, reject) {
              const url = new URL(`/rest/v1/${table}`, root);
              state.filters.forEach(([key, value]) => url.searchParams.set(key, value));
              return fetch(url, { method: "DELETE", headers: { ...headers, Prefer: "return=minimal" }, cache: "no-store" }).then(async (response) => {
                const data = await response.json().catch(() => null);
                if (!response.ok) return { data: null, error: queryError(data, response.status) };
                return { data, error: null };
              }).then(resolve, reject);
            }
          };
          return chain;
        }
      };
    },
    auth: {
      async getUser(token) {
        const response = await fetch(`${root}/auth/v1/user`, { headers: { apikey: apiKey, Authorization: `Bearer ${token}` }, cache: "no-store" });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return { data: { user: null }, error: queryError(data, response.status) };
        return { data: { user: data }, error: null };
      }
    }
  };
}

export function emptyState() { return { version: 1, profile: { name: "Borja", risk: "Moderado", emergency: 3, contribution: 300, liveCoach: false }, accounts: [], assets: [], debts: [], transactions: [], goals: [], imports: [], snapshots: [] }; }
export function getBearer(req) { const value = req.headers.authorization || ""; return value.startsWith("Bearer ") ? value.slice(7) : ""; }
export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => { raw += chunk; if (raw.length > 2_000_000) { reject(new Error("La petición es demasiado grande.")); req.destroy(); } });
    req.on("end", () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch (_) { reject(new Error("JSON inválido.")); } });
    req.on("error", reject);
  });
}

export function createConfiguredClient(req) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !anonKey) throw new Error("Supabase no está configurado.");
  const ownerId = process.env.BORJAI_OWNER_ID || "";
  const token = getBearer(req);
  if (serviceKey) {
    return {
      client: createRestClient(url, serviceKey, serviceKey),
      userId: ownerId || null,
      token: token || null,
      tokenUserId: null,
      serviceRole: true,
      mode: ownerId ? "service_role_owner" : token ? "service_role_authenticated_user" : "service_role_discovered_owner"
    };
  }
  if (!token) throw new Error("Sesión de BorjaAI no disponible.");
  return { client: createRestClient(url, anonKey, token), token, serviceRole: false, mode: "rls_user" };
}

async function discoverAuthUserId(context) {
  const root = String(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!root || !serviceKey) return null;
  const response = await fetch(`${root}/auth/v1/admin/users?per_page=1000&page=1`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, Accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => ({}));
  const users = Array.isArray(payload) ? payload : (payload.users || []);
  const allowed = users.find((user) => user?.email && user.email.toLowerCase() === "borjabuzquin@gmail.com") || users.find((user) => user?.id);
  return allowed?.id || null;
}

export async function resolveUser(context) {
  if (context.userId) return context.userId;
  if (context.serviceRole) {
    if (context.token) {
      const authResult = await context.client.auth.getUser(context.token);
      if (!authResult.error && authResult.data?.user?.id) {
        context.userId = authResult.data.user.id;
        return context.userId;
      }
    }
    const authUserId = await discoverAuthUserId(context);
    if (authUserId) {
      context.userId = authUserId;
      return context.userId;
    }
    for (const table of TABLES) {
      const result = await context.client.from(table).select("user_id").order("created_at", { ascending: true });
      if (result.error) continue;
      const candidate = (result.data || []).find((row) => row.user_id);
      if (candidate?.user_id) { context.userId = candidate.user_id; return context.userId; }
    }
    throw new Error("No se pudo identificar la cuenta de BorjaAI.");
  }
  const result = await context.client.auth.getUser(context.token);
  if (result.error || !result.data?.user?.id) throw new Error("Sesión de BorjaAI no válida.");
  context.userId = result.data.user.id;
  return context.userId;
}

export async function loadRows(context) {
  const userId = await resolveUser(context);
  const rows = {};
  for (const table of TABLES) {
    const result = await context.client.from(table).select("*").eq("user_id", userId).order("created_at", { ascending: true });
    if (result.error) throw new Error(`Error leyendo ${table}: ${result.error.message}`);
    rows[table] = result.data || [];
  }
  return rows;
}

function rowKey(table, row) { if (table === "categories") return `${row.name || ""}|${row.type || ""}`; return String(row.legacy_id || row.id || ""); }
async function deleteStaleRows(context, table, desiredRows) {
  const userId = await resolveUser(context);
  const select = table === "categories" ? "id,name,type" : "id,legacy_id";
  const result = await context.client.from(table).select(select).eq("user_id", userId).order("created_at", { ascending: true });
  if (result.error) throw new Error(`Error preparando limpieza de ${table}: ${result.error.message}`);
  const desired = new Set((desiredRows || []).map((row) => rowKey(table, row)));
  const staleIds = (result.data || []).filter((row) => !desired.has(rowKey(table, row))).map((row) => row.id);
  if (!staleIds.length) return;
  const del = await context.client.from(table).delete().eq("user_id", userId).in("id", staleIds);
  if (del.error) throw new Error(`Error eliminando obsoletos de ${table}: ${del.error.message}`);
}

export async function replaceState(context, state) {
  const userId = await resolveUser(context);
  const normalized = normalizeState(state, emptyState);
  const validation = validateLegacyState(normalized);
  if (!validation.ok) throw new Error(validation.errors.join(" "));
  const rows = toDatabaseRows(normalized, userId);
  for (const table of TABLES) {
    const desiredRows = rows[table] || [];
    if (!desiredRows.length) continue;
    const result = await context.client.from(table).upsert(desiredRows, { onConflict: CONFLICT_KEYS[table] });
    if (result.error) throw new Error(`Error guardando ${table}: ${result.error.message}`);
    await deleteStaleRows(context, table, desiredRows);
  }
  for (const table of TABLES) {
    const desiredRows = rows[table] || [];
    if (desiredRows.length) continue;
    await deleteStaleRows(context, table, desiredRows);
  }
  return normalized;
}

function mergeById(current, incoming) { const merged = new Map(); (current || []).forEach((item) => merged.set(item.id, item)); (incoming || []).forEach((item) => merged.set(item.id, item)); return [...merged.values()]; }
export async function migrateState(context, localState) {
  const normalized = normalizeState(localState, emptyState);
  const validation = validateLegacyState(normalized);
  if (!validation.ok) return { ok: false, errors: validation.errors };
  const current = fromDatabaseRows(await loadRows(context), emptyState);
  const merged = { ...current, profile: { ...current.profile, ...normalized.profile }, accounts: mergeById(current.accounts, normalized.accounts), assets: mergeById(current.assets, normalized.assets), debts: mergeById(current.debts, normalized.debts), transactions: mergeById(current.transactions, normalized.transactions), goals: mergeById(current.goals, normalized.goals), imports: mergeById(current.imports, normalized.imports), snapshots: mergeById(current.snapshots, normalized.snapshots) };
  const saved = await replaceState(context, merged);
  const loaded = fromDatabaseRows(await loadRows(context), emptyState);
  return { ok: true, before: stateCounts(normalized), after: stateCounts(loaded), state: saved };
}
export { TABLES };
