import { fromDatabaseRows, normalizeState, stateCounts, toDatabaseRows, validateLegacyState } from "./stateMapper.js";

const TABLES = ["accounts", "categories", "transactions", "assets", "liabilities", "investments", "goals", "imports", "wealth_snapshots"];

async function requireUser(client) {
  const result = await client.auth.getUser();
  if (result.error) throw result.error;
  if (!result.data || !result.data.user) throw new Error("Inicia sesion para usar la base de datos de BorjaAI.");
  return result.data.user;
}

async function selectAll(client, table) {
  const result = await client.from(table).select("*").order("created_at", { ascending: true });
  if (result.error) throw result.error;
  return result.data || [];
}

export function createSupabaseRepository(client, fallbackFactory) {
  return {
    kind: "supabase",
    async getUser() {
      return requireUser(client);
    },
    async load() {
      await requireUser(client);
      const rows = {};
      for (const table of TABLES) rows[table] = await selectAll(client, table);
      return fromDatabaseRows(rows, fallbackFactory);
    },
    async saveState(state) {
      const user = await requireUser(client);
      const normalized = normalizeState(state, fallbackFactory);
      const validation = validateLegacyState(normalized);
      if (!validation.ok) throw new Error(validation.errors.join(" "));
      const rows = toDatabaseRows(normalized, user.id);

      for (const table of TABLES) {
        const del = await client.from(table).delete().eq("user_id", user.id);
        if (del.error) throw del.error;
        if (rows[table] && rows[table].length) {
          const insert = await client.from(table).insert(rows[table]);
          if (insert.error) throw insert.error;
        }
      }
      return normalized;
    },
    async reset() {
      const user = await requireUser(client);
      for (const table of TABLES) {
        const del = await client.from(table).delete().eq("user_id", user.id);
        if (del.error) throw del.error;
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
      return {
        ok: true,
        before: stateCounts(normalized),
        after: stateCounts(loaded),
        state: loaded
      };
    }
  };
}
