import { hasSupabaseConfig, LOCAL_BACKUP_KEY, LOCAL_STORAGE_KEY, MIGRATION_STATUS_KEY, loadRuntimeConfig } from "../config.js";
import { createSupabaseClient } from "../db/supabaseClient.js";
import { createLocalStorageRepository } from "../repositories/localStorageRepository.js";
import { createSupabaseRepository } from "../repositories/supabaseRepository.js";
import { normalizeState, stateCounts, validateLegacyState } from "../repositories/stateMapper.js";

function today() { return new Date().toISOString().slice(0, 10); }
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
  let backendStatus = { mode: "local", connected: false, error: "" };

  async function connectBackend() {
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
    backendStatus = {
      mode: hasSupabaseConfig(config) ? "unavailable" : "local",
      connected: false,
      error: e.message || "No se pudo conectar con Supabase."
    };
  }

  async function loadFromBackend() {
    const repo = activeRepository.kind === "supabase" ? activeRepository : await connectBackend();
    return repo.load();
  }

  async function load() {
    try {
      const remote = await loadFromBackend();
      backendStatus = { mode: "supabase", connected: true, error: "" };
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
          localRepository.setMigrationStatus(MIGRATION_STATUS_KEY, { ok: true, reason: "reconciled_local_changes", before: localCounts, after: stateCounts(reconciled), createdAt: new Date().toISOString() });
          const ensured = ensureDailySnapshot(reconciled);
          await localRepository.saveState(ensured.state);
          if (ensured.changed) await activeRepository.saveState(ensured.state);
          return ensured.state;
        }
      }
      const ensured = ensureDailySnapshot(remote);
      await localRepository.saveState(ensured.state);
      if (ensured.changed) await activeRepository.saveState(ensured.state);
      return ensured.state;
    } catch (e) {
      backendStatus = {
        mode: hasSupabaseConfig(config) ? "unavailable" : "local",
        connected: false,
        error: e.message || "Backend no disponible."
      };
      activeRepository = localRepository;
      return localRepository.load();
    }
  }

  async function saveState(state) {
    let normalized = normalizeState(state, fallbackFactory);
    const ensured = ensureDailySnapshot(normalized);
    normalized = ensured.state;

    try {
      if (activeRepository.kind !== "supabase") await connectBackend();
      if (typeof activeRepository.loadSnapshots === "function") {
        const remoteSnapshots = await activeRepository.loadSnapshots();
        normalized.snapshots = mergeSnapshots(remoteSnapshots, normalized.snapshots);
      }
      const finalState = ensureDailySnapshot(normalized).state;
      await localRepository.saveState(finalState);
      const saved = await activeRepository.saveState(finalState);
      backendStatus = { mode: "supabase", connected: true, error: "" };
      return saved;
    } catch (e) {
      backendStatus = {
        mode: hasSupabaseConfig(config) ? "unavailable" : "local",
        connected: false,
        error: e.message || "No se pudo guardar en Supabase."
      };
      throw e;
    }
  }

  async function reset() {
    try {
      if (activeRepository.kind !== "supabase") await connectBackend();
      const next = await activeRepository.reset();
      await localRepository.saveState(next);
      backendStatus = { mode: "supabase", connected: true, error: "" };
      return next;
    } catch (e) {
      backendStatus = {
        mode: hasSupabaseConfig(config) ? "unavailable" : "local",
        connected: false,
        error: e.message || "No se pudo restablecer en backend."
      };
      throw e;
    }
  }

  async function migrateLocalState() {
    const localState = localRepository.readRaw();
    const validation = validateLegacyState(localState);
    if (!validation.ok) return { ok: false, errors: validation.errors };
    localRepository.backup(LOCAL_BACKUP_KEY);
    try {
      if (activeRepository.kind !== "supabase") await connectBackend();
      const result = await activeRepository.migrateFromLocal(localState);
      backendStatus = { mode: "supabase", connected: true, error: "" };
      const status = Object.assign({ createdAt: new Date().toISOString() }, result);
      localRepository.setMigrationStatus(MIGRATION_STATUS_KEY, status);
      return status;
    } catch (e) {
      backendStatus = {
        mode: hasSupabaseConfig(config) ? "unavailable" : "local",
        connected: false,
        error: e.message || "No se pudo migrar al backend."
      };
      const status = { ok: false, reason: "backend_unavailable", counts: stateCounts(localState), createdAt: new Date().toISOString(), error: backendStatus.error };
      localRepository.setMigrationStatus(MIGRATION_STATUS_KEY, status);
      return status;
    }
  }

  async function getAccessToken() {
    if (activeRepository.kind !== "supabase") await connectBackend();
    if (typeof activeRepository.getAccessToken !== "function") throw new Error("No se pudo obtener la sesión de Supabase.");
    return activeRepository.getAccessToken();
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
