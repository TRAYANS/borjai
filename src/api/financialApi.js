import { hasSupabaseConfig, LOCAL_BACKUP_KEY, LOCAL_STORAGE_KEY, MIGRATION_STATUS_KEY, loadRuntimeConfig } from "../config.js";
import { createSupabaseClient } from "../db/supabaseClient.js";
import { createLocalStorageRepository } from "../repositories/localStorageRepository.js";
import { createSupabaseRepository } from "../repositories/supabaseRepository.js";
import { normalizeState, stateCounts, validateLegacyState } from "../repositories/stateMapper.js";

export async function createFinancialApi(options) {
  const fallbackFactory = options.fallbackFactory;
  const localKey = options.localKey || LOCAL_STORAGE_KEY;
  const storage = options.storage;
  const config = await loadRuntimeConfig(options.config);
  const localRepository = createLocalStorageRepository(localKey, fallbackFactory, storage);
  let activeRepository = localRepository;
  let backendStatus = { mode: "local", connected: false, error: "" };

  if (hasSupabaseConfig(config)) {
    try {
      const client = await createSupabaseClient(config);
      if (client) {
        activeRepository = createSupabaseRepository(client, fallbackFactory);
        await activeRepository.getUser();
        backendStatus = { mode: "supabase", connected: true, error: "" };
      }
    } catch (e) {
      activeRepository = localRepository;
      backendStatus = { mode: "local", connected: false, error: e.message || "No se pudo conectar con Supabase." };
    }
  }

  async function load() {
    try {
      const remote = await activeRepository.load();

      if (activeRepository.kind === "supabase") {
        const localState = localRepository.readRaw();
        const validation = validateLegacyState(localState);
        if (validation.ok) {
          const localNormalized = normalizeState(localState, fallbackFactory);
          const remoteCounts = stateCounts(remote);
          const localCounts = stateCounts(localNormalized);
          const localHasNewerData =
            localCounts.transactions > remoteCounts.transactions ||
            localCounts.accounts > remoteCounts.accounts ||
            localCounts.assets > remoteCounts.assets ||
            localCounts.goals > remoteCounts.goals ||
            localCounts.imports > remoteCounts.imports ||
            localCounts.wealthSnapshots > remoteCounts.wealthSnapshots;

          if (localHasNewerData) {
            localRepository.backup(LOCAL_BACKUP_KEY);
            await activeRepository.migrateFromLocal(localNormalized);
            const reconciled = await activeRepository.load();
            localRepository.setMigrationStatus(MIGRATION_STATUS_KEY, {
              ok: true,
              reason: "reconciled_local_changes",
              before: localCounts,
              after: stateCounts(reconciled),
              createdAt: new Date().toISOString()
            });
            return reconciled;
          }
        }
      }

      return remote;
    } catch (e) {
      backendStatus = { mode: "local", connected: false, error: e.message || "Backend no disponible. Usando datos locales." };
      activeRepository = localRepository;
      return localRepository.load();
    }
  }

  async function saveState(state) {
    const normalized = normalizeState(state, fallbackFactory);
    await localRepository.saveState(normalized);

    if (activeRepository.kind === "supabase") {
      try {
        const saved = await activeRepository.saveState(normalized);
        backendStatus = { mode: "supabase", connected: true, error: "" };
        return saved;
      } catch (e) {
        backendStatus = { mode: "local", connected: false, error: e.message || "No se pudo guardar en Supabase. Se conserva una copia local." };
        throw e;
      }
    }

    return normalized;
  }

  async function reset() {
    const next = await localRepository.reset();
    if (activeRepository.kind === "supabase") {
      try {
        await activeRepository.reset();
      } catch (e) {
        backendStatus = { mode: "local", connected: false, error: e.message || "No se pudo restablecer en backend." };
      }
    }
    return next;
  }

  async function migrateLocalState() {
    const localState = localRepository.readRaw();
    const validation = validateLegacyState(localState);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    localRepository.backup(LOCAL_BACKUP_KEY);

    if (activeRepository.kind !== "supabase") {
      const normalized = normalizeState(localState, fallbackFactory);
      const status = { ok: false, reason: "backend_unavailable", counts: stateCounts(normalized), createdAt: new Date().toISOString() };
      localRepository.setMigrationStatus(MIGRATION_STATUS_KEY, status);
      return status;
    }

    const result = await activeRepository.migrateFromLocal(localState);
    const status = Object.assign({ createdAt: new Date().toISOString() }, result);
    localRepository.setMigrationStatus(MIGRATION_STATUS_KEY, status);
    return status;
  }

  return {
    load: load,
    saveState: saveState,
    reset: reset,
    migrateLocalState: migrateLocalState,
    backendStatus: function() { return backendStatus; },
    migrationStatus: function() { return localRepository.getMigrationStatus(MIGRATION_STATUS_KEY); }
  };
}
