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
    throw new Error(
      "No existe una sesión de usuario en Supabase."
    );
  }

  return result.data.user;
}

async function selectAll(client, table) {
  const result = await client
    .from(table)
    .select("*")
    .order("created_at", { ascending: true });

  if (result.error) throw result.error;

  return result.data || [];
}

async function upsertTable(client, table, rows) {
  if (!rows || rows.length === 0) {
    return;
  }

  const conflict = CONFLICT_KEYS[table];

  if (!conflict) {
    throw new Error(
      `No existe configuración de conflicto para ${table}.`
    );
  }

  const result = await client
    .from(table)
    .upsert(rows, {
      onConflict: conflict
    });

  if (result.error) {
    throw new Error(
      `Error guardando ${table}: ${result.error.message}`
    );
  }
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

      for (const table of TABLES) {
        rows[table] = await selectAll(client, table);
      }

      const loaded = fromDatabaseRows(rows, fallbackFactory);

      // Si Supabase todavía no tiene cuentas, conservamos las cuentas
      // iniciales para que los selectores de origen/destino sigan funcionando.
      if (!Array.isArray(loaded.accounts) || loaded.accounts.length === 0) {
        const fallback = fallbackFactory();
        loaded.accounts = Array.isArray(fallback.accounts) ? fallback.accounts : [];
      }

      return loaded;
    },

    async saveState(state) {
      const user = await requireUser(client);

      const normalized = normalizeState(
        state,
        fallbackFactory
      );

      const validation = validateLegacyState(normalized);

      if (!validation.ok) {
        throw new Error(validation.errors.join(" "));
      }

      const rows = toDatabaseRows(
        normalized,
        user.id
      );

      /*
       * IMPORTANTE:
       *
       * No hacemos DELETE antes de guardar.
       *
       * Cada registro se actualiza o crea mediante UPSERT.
       * Si una operación falla, los datos existentes
       * no se destruyen previamente.
       */

      for (const table of TABLES) {
        await upsertTable(
          client,
          table,
          rows[table]
        );
      }

      return normalized;
    },

    async reset() {
      const user = await requireUser(client);

      /*
       * El reset sigue siendo una operación destructiva,
       * por lo que se mantiene separada del guardado normal.
       */

      for (const table of TABLES) {
        const del = await client
          .from(table)
          .delete()
          .eq("user_id", user.id);

        if (del.error) {
          throw new Error(
            `No se pudo limpiar ${table}: ${del.error.message}`
          );
        }
      }

      const next = fallbackFactory();

      await this.saveState(next);

      return next;
    },

    async migrateFromLocal(localState) {
      const normalized = normalizeState(
        localState,
        fallbackFactory
      );

      const validation = validateLegacyState(
        normalized
      );

      if (!validation.ok) {
        return {
          ok: false,
          errors: validation.errors
        };
      }

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
