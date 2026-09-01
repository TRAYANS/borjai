import { hasSupabaseConfig, LOCAL_BACKUP_KEY, LOCAL_STORAGE_KEY, MIGRATION_STATUS_KEY, loadRuntimeConfig } from "../config.js";
import { createSupabaseClient } from "../db/supabaseClient.js";
import { createLocalStorageRepository } from "../repositories/localStorageRepository.js";
import { createSupabaseRepository } from "../repositories/supabaseRepository.js";
import { createServerApiRepository } from "../repositories/serverApiRepository.js";
import { normalizeState, stateCounts, validateLegacyState } from "../repositories/stateMapper.js";

function today() { return new Date().toISOString().slice(0, 10); }
function statusMode(repository) {
  if (repository.kind === "server-api") return "api";
  if (repository.kind === "supabase") return "supabase";
  return "local";
}
function isRemoteRepository(repository) {
  return repository && (repository.kind === "server-api" || repository.kind === "supabase");
}
function wealthFromState(state) {
  const accounts = (state.accounts || []).reduce((sum, a) => sum + Number(a.balance || 0), 0);
  const assets = (state.assets || []).reduce((sum, a) => sum + Number(a.value || 0), 0);
  const debts = (state.debts || []).reduce((sum, d) => sum + Number(d.balance || d.outstandingBalance || 0), 0);
  return accounts + assets - debts;
}
function snapshotDate(snapshot) {
  if (snapshot?.date) return String(snapshot.date).slice(0, 10);
  if (snapshot?.month) {
    const value = String(snapshot.month);
    return value.length === 7 ? `${value}-01` : value.slice(0, 10);
  }
  return "";
}
function mergeSnapshots(existing, incoming) {
  const byDate = new Map();
  for (const snapshot of [...(existing || []), ...(incoming || [])]) {
    const date = snapshotDate(snapshot);
    if (!date) continue;
    byDate.set(date, { ...snapshot, date, value: Number(snapshot.value || snapshot.net_worth || 0) });
  }
  return [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-1825);
}
function ensureDailySnapshot(state) {
  const next = { ...state, snapshots: Array.isArray(state.snapshots) ? [...state.snapshots] : [] };
  const date = today();
  const value = wealthFromState(next);
  const existing = next.snapshots.find((s) => snapshotDate(s) === date);
  let changed = false;
  if (existing) {
    if (Number(existing.value || existing.net_worth || 0) !== value || existing.date !== date) {
      existing.date = date;
      existing.value = value;
      delete existing.month;
      changed = true;
    }
  } else {
    next.snapshots.push({ date, value, source: "daily" });
    changed = true;
  }
  next.snapshots = mergeSnapshots([], next.snapshots);
  if (next.snapshots.length > 1825) changed = true;
  return { state: next, changed };
}

export async function createFinancialApi(options) {
  const fallbackFactory = options.fallbackFactory;
  const localKey = options.localKey || LOCAL_STORAGE_KEY;
  const storage = options.storage;
  const config = await loadRuntimeConfig(options.config);
  const localRepository = createLocalStorageRepository(localKey, fallbackFactory, storage);
  let activeRepository = localRepository;
  let sessionClient = null;
  let backendStatus = { mode: "initializing", connected: false, error: "" };

  const localDevelopmentMode = !hasSupabaseConfig(config) && config.backendMode !== "api";

  async function getAccessToken() {
    if (!sessionClient) {
      if (!hasSupabaseConfig(config)) return "";
      sessionClient = await createSupabaseClient(config);
    }
    const result = await sessionClient.auth.getSession();
    if (result.error) throw result.error;
    return result.data?.session?.access_token || "";
  }

  async function connectServerApi() {
    const repo = createServerApiRepository({ baseUrl: config.apiBaseUrl || "", getAccessToken });
    await repo.health();
    activeRepository = repo;
    backendStatus = { mode: "api", connected: true, error: "" };
    return repo;
  }

  async function connectBackend() {
    if (localDevelopmentMode) {
      activeRepository = localRepository;
      backendStatus = { mode: "local", connected: false, error: "" };
      return localRepository;
    }
    if (config.backendMode === "api") return connectServerApi();
    if (!hasSupabaseConfig(config)) throw new Error("Supabase no está configurado en producción.");
    const client = await createSupabaseClient(config);
    if (!client) throw new Error("No se pudo crear el cliente Supabase.");
    const repo = createSupabaseRepository(client, fallbackFactory);
    await repo.getUser();
    activeRepository = repo;
    backendStatus = { mode: "supabase", connected: true, error: "" };
    return repo;
  }

  try {
    await connectBackend();
  } catch (e) {
    backendStatus = { mode: localDevelopmentMode ? "local" : "unavailable", connected: false, error: e.message || "No se pudo conectar con Supabase." };
    if (localDevelopmentMode) activeRepository = localRepository;
  }

  async function loadFromBackend() {
    const repo = isRemoteRepository(activeRepository) ? activeRepository : await connectBackend();
    return repo.load();
  }

  async function load() {
    try {
      const remote = await loadFromBackend();
      backendStatus = { mode: statusMode(activeRepository), connected: activeRepository.kind !== "local", error: "" };

      // In production, Supabase is the source of truth. Do NOT automatically
      // migrate stale localStorage data back into the backend: an old browser
      // cache could otherwise resurrect deleted financial data after a reset.
      // Local migration remains available only through the explicit migration
      // action below.
      const ensured = ensureDailySnapshot(remote);
      await localRepository.saveState(ensured.state);
      if (ensured.changed) await activeRepository.saveState(ensured.state);
      return ensured.state;
    } catch (e) {
      backendStatus = { mode: localDevelopmentMode ? "local" : "unavailable", connected: false, error: e.message || "Backend no disponible." };
      if (localDevelopmentMode) {
        activeRepository = localRepository;
        return localRepository.load();
      }
      return fallbackFactory();
    }
  }

  async function saveState(state) {
    let normalized = normalizeState(state, fallbackFactory);
    const ensured = ensureDailySnapshot(normalized);
    normalized = ensured.state;

    try {
      if (!isRemoteRepository(activeRepository)) await connectBackend();
      if (typeof activeRepository.loadSnapshots === "function") {
        const remoteSnapshots = await activeRepository.loadSnapshots();
        normalized.snapshots = mergeSnapshots(remoteSnapshots, normalized.snapshots);
      }
      const finalState = ensureDailySnapshot(normalized).state;
      await localRepository.saveState(finalState);
      const saved = await activeRepository.saveState(finalState);
      backendStatus = { mode: statusMode(activeRepository), connected: activeRepository.kind !== "local", error: "" };
      return saved;
    } catch (e) {
      backendStatus = { mode: localDevelopmentMode ? "local" : "unavailable", connected: false, error: e.message || "No se pudo guardar en Supabase." };
      if (localDevelopmentMode) {
        await localRepository.saveState(normalized);
        return normalized;
      }
      throw e;
    }
  }

  async function reset() {
    try {
      if (!isRemoteRepository(activeRepository)) await connectBackend();
      const next = await activeRepository.reset();
      await localRepository.saveState(next);
      backendStatus = { mode: statusMode(activeRepository), connected: activeRepository.kind !== "local", error: "" };
      return next;
    } catch (e) {
      backendStatus = { mode: localDevelopmentMode ? "local" : "unavailable", connected: false, error: e.message || "No se pudo restablecer en backend." };
      if (localDevelopmentMode) return localRepository.reset();
      throw e;
    }
  }

  async function migrateLocalState() {
    const localState = localRepository.readRaw();
    const validation = validateLegacyState(localState);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    localRepository.backup(LOCAL_BACKUP_KEY);
    try {
      if (!isRemoteRepository(activeRepository)) await connectBackend();
      const result = await activeRepository.migrateFromLocal(localState);
      backendStatus = { mode: statusMode(activeRepository), connected: activeRepository.kind !== "local", error: "" };
      const status = Object.assign({ createdAt: new Date().toISOString() }, result);
      localRepository.setMigrationStatus(MIGRATION_STATUS_KEY, status);
      return status;
    } catch (e) {
      backendStatus = { mode: localDevelopmentMode ? "local" : "unavailable", connected: false, error: e.message || "No se pudo migrar al backend." };
      const status = { ok: false, reason: "backend_unavailable", counts: stateCounts(localState), createdAt: new Date().toISOString(), error: backendStatus.error };
      localRepository.setMigrationStatus(MIGRATION_STATUS_KEY, status);
      return status;
    }
  }

  return {
    load,
    saveState,
    reset,
    migrateLocalState,
    backendStatus: () => backendStatus,
    migrationStatus: () => localRepository.getMigrationStatus(MIGRATION_STATUS_KEY),
    reconnect: async () => { await connectBackend(); return backendStatus; },
    getAccessToken
  };
}
