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
      return await activeRepository.load();
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
        return await activeRepository.saveState(normalized);
      } catch (e) {
        backendStatus = { mode: "local", connected: false, error: e.message || "No se pudo guardar en backend. Copia local conservada." };
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
