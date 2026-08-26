import {
  fromDatabaseRows,
  normalizeState,
  stateCounts,
  toDatabaseRows,
  validateLegacyState
} from "./stateMapper.js";

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

async function requireUser(client) {
  const result = await client.auth.getUser();
  if (result.error) throw result.error;
  if (!result.data || !result.data.user) {
    throw new Error("No existe una sesión de usuario en Supabase.");
  }
  return result.data.user;
}

async function selectAll(client, table, userId) {
  const result = await client
    .from(table)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (result.error) throw result.error;
  return result.data || [];
}

function desiredKey(table, row) {
  if (table === "categories") return `${row.name || ""}|${row.type || ""}`;
  return String(row.legacy_id || row.id || "");
}

function existingKey(table, row) {
  if (table === "categories") return `${row.name || ""}|${row.type || ""}`;
  return String(row.legacy_id || row.id || "");
}

async function deleteStaleRows(client, table, desiredRows, userId) {
  const query = table === "categories"
    ? client.from(table).select("id,name,type").eq("user_id", userId)
    : client.from(table).select("id,legacy_id").eq("user_id", userId);

  const result = await query.order("created_at", { ascending: true });
  if (result.error) throw result.error;

  const desired = new Set((desiredRows || []).map((row) => desiredKey(table, row)));
  const staleIds = (result.data || [])
    .filter((row) => !desired.has(existingKey(table, row)))
    .map((row) => row.id)
    .filter(Boolean);

  if (!staleIds.length) return;

  const del = await client.from(table).delete().eq("user_id", userId).in("id", staleIds);
  if (del.error) {
    throw new Error(`Error eliminando registros obsoletos de ${table}: ${del.error.message}`);
  }
}

async function upsertTable(client, table, rows, userId) {
  const desiredRows = rows || [];
  const conflict = CONFLICT_KEYS[table];
  if (!conflict) throw new Error(`No existe configuración de conflicto para ${table}.`);

  await deleteStaleRows(client, table, desiredRows, userId);
  if (!desiredRows.length) return;

  const result = await client
    .from(table)
    .upsert(desiredRows, { onConflict: conflict });

  if (result.error) {
    throw new Error(`Error guardando ${table}: ${result.error.message}`);
  }
}

export function createSupabaseRepository(client, fallbackFactory) {
  return {
    kind: "supabase",

    async getUser() {
      return requireUser(client);
    },

    async getAccessToken() {
      const result = await client.auth.getSession();
      if (result.error) throw result.error;
      return result.data?.session?.access_token || "";
    },

    async loadSnapshots() {
      const user = await requireUser(client);
      const rows = await selectAll(client, "wealth_snapshots", user.id);
      return fromDatabaseRows({ wealth_snapshots: rows }, fallbackFactory).snapshots;
    },

    async load() {
      const user = await requireUser(client);
      const rows = {};
      for (const table of TABLES) rows[table] = await selectAll(client, table, user.id);
      const loaded = fromDatabaseRows(rows, fallbackFactory);

      if (!Array.isArray(loaded.accounts) || loaded.accounts.length === 0) {
        const fallback = fallbackFactory();
        loaded.accounts = Array.isArray(fallback.accounts) ? fallback.accounts : [];
      }
      return loaded;
    },

    async saveState(state) {
      const user = await requireUser(client);
      const normalized = normalizeState(state, fallbackFactory);
      const validation = validateLegacyState(normalized);
      if (!validation.ok) throw new Error(validation.errors.join(" "));
      const rows = toDatabaseRows(normalized, user.id);

      for (const table of TABLES) {
        await upsertTable(client, table, rows[table], user.id);
      }

      return normalized;
    },

    async reset() {
      const user = await requireUser(client);
      for (const table of TABLES) {
        const del = await client.from(table).delete().eq("user_id", user.id);
        if (del.error) throw new Error(`No se pudo limpiar ${table}: ${del.error.message}`);
      }
      const next = fallbackFactory();
      await this.saveState(next);
      return next;
    },

    async migrateFromLocal(localState) {
      const normalized = normalizeState(localState, fallbackFactory);
      const validation = validateLegacyState(normalized);
      if (!validation.ok) return { ok: false, errors: validation.errors };
      await this.saveState(normalized);
      const loaded = await this.load();
      return { ok: true, before: stateCounts(normalized), after: stateCounts(loaded), state: loaded };
    }
  };
}
