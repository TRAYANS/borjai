import { createClient } from "@supabase/supabase-js";
import {
  fromDatabaseRows,
  normalizeState,
  stateCounts,
  toDatabaseRows,
  validateLegacyState
} from "../src/repositories/stateMapper.js";

const TABLES = [
  "accounts",
  "categories",
  "transactions",
  "assets",
  "liabilities",
  "investments",
  "goals",
  "imports",
  "wealth_snapshots"
];

const CONFLICT_KEYS = {
  accounts: "user_id,legacy_id",
  categories: "user_id,name,type",
  transactions: "user_id,legacy_id",
  assets: "user_id,legacy_id",
  liabilities: "user_id,legacy_id",
  investments: "user_id,legacy_id",
  goals: "user_id,legacy_id",
  imports: "user_id,legacy_id",
  wealth_snapshots: "user_id,legacy_id"
};

export function emptyState() {
  return {
    version: 1,
    profile: { name: "Borja", risk: "Moderado", emergency: 3, contribution: 300, liveCoach: false },
    accounts: [],
    assets: [],
    debts: [],
    transactions: [],
    goals: [],
    imports: [],
    snapshots: []
  };
}

export function getBearer(req) {
  const value = req.headers.authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

export async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) {
        reject(new Error("La petición es demasiado grande."));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (_) { reject(new Error("JSON inválido.")); }
    });
    req.on("error", reject);
  });
}

export function createConfiguredClient(req) {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !anonKey) throw new Error("Supabase no está configurado.");

  const ownerId = process.env.BORJAI_OWNER_ID || "";
  if (serviceKey && ownerId) {
    return {
      client: createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      }),
      userId: ownerId,
      mode: "service_role_owner"
    };
  }

  const token = getBearer(req);
  if (!token) throw new Error("Sesión de BorjaAI no disponible.");
  return {
    client: createClient(url, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    }),
    token,
    mode: "rls_user"
  };
}

export async function resolveUser(context) {
  if (context.userId) return context.userId;
  const result = await context.client.auth.getUser(context.token);
  if (result.error || !result.data?.user?.id) throw new Error("Sesión de BorjaAI no válida.");
  context.userId = result.data.user.id;
  return context.userId;
}

export async function loadRows(context) {
  const userId = await resolveUser(context);
  const rows = {};
  for (const table of TABLES) {
    const result = await context.client
      .from(table)
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    if (result.error) throw new Error(`Error leyendo ${table}: ${result.error.message}`);
    rows[table] = result.data || [];
  }
  return rows;
}

function rowKey(table, row) {
  if (table === "categories") return `${row.name || ""}|${row.type || ""}`;
  return String(row.legacy_id || row.id || "");
}

async function deleteStaleRows(context, table, desiredRows) {
  const userId = await resolveUser(context);
  const select = table === "categories" ? "id,name,type" : "id,legacy_id";
  const result = await context.client.from(table).select(select).eq("user_id", userId);
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
    await deleteStaleRows(context, table, desiredRows);
    if (!desiredRows.length) continue;
    const result = await context.client.from(table).upsert(desiredRows, {
      onConflict: CONFLICT_KEYS[table]
    });
    if (result.error) throw new Error(`Error guardando ${table}: ${result.error.message}`);
  }
  return normalized;
}

function mergeById(current, incoming) {
  const merged = new Map();
  (current || []).forEach((item) => merged.set(item.id, item));
  (incoming || []).forEach((item) => merged.set(item.id, item));
  return [...merged.values()];
}

export async function migrateState(context, localState) {
  const normalized = normalizeState(localState, emptyState);
  const validation = validateLegacyState(normalized);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const current = fromDatabaseRows(await loadRows(context), emptyState);
  const merged = {
    ...current,
    profile: { ...current.profile, ...normalized.profile },
    accounts: mergeById(current.accounts, normalized.accounts),
    assets: mergeById(current.assets, normalized.assets),
    debts: mergeById(current.debts, normalized.debts),
    transactions: mergeById(current.transactions, normalized.transactions),
    goals: mergeById(current.goals, normalized.goals),
    imports: mergeById(current.imports, normalized.imports),
    snapshots: mergeById(current.snapshots, normalized.snapshots)
  };
  const saved = await replaceState(context, merged);
  const loaded = fromDatabaseRows(await loadRows(context), emptyState);
  return { ok: true, before: stateCounts(normalized), after: stateCounts(loaded), state: saved };
}

export { TABLES };
