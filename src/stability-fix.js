import { LOCAL_STORAGE_KEY, loadRuntimeConfig } from "./config.js";
import { createSupabaseClient } from "./db/supabaseClient.js";
import { createSupabaseRepository } from "./repositories/supabaseRepository.js";
import * as finance from "./finance.js";

const MAX_DAILY_SNAPSHOTS = 1825;
let lastStateSignature = "";
let busy = false;
let client = null;
let repository = null;

function readState() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

function signature(state) {
  if (!state) return "";
  return JSON.stringify({
    version: state.version,
    profile: state.profile,
    accounts: state.accounts,
    assets: state.assets,
    debts: state.debts,
    transactions: state.transactions,
    goals: state.goals,
    imports: state.imports
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function ensureDailySnapshot(state) {
  if (!state || !Array.isArray(state.snapshots)) return false;
  const netWorth = Number(finance.wealth(state) || 0);
  if (!Number.isFinite(netWorth)) return false;

  const date = today();
  const month = date.slice(0, 7);
  const existing = state.snapshots.find(s => String(s.date || "").slice(0, 10) === date);

  if (existing) {
    const changed = Number(existing.value) !== netWorth || existing.month !== month;
    existing.value = netWorth;
    existing.date = date;
    existing.month = month;
    return changed;
  }

  state.snapshots.push({ date, month, value: netWorth, source: "daily" });
  state.snapshots = state.snapshots
    .filter(s => s && (s.date || s.month))
    .sort((a, b) => String(a.date || a.month).localeCompare(String(b.date || b.month)))
    .slice(-MAX_DAILY_SNAPSHOTS);
  return true;
}

async function connect() {
  if (repository) return true;
  try {
    const config = await loadRuntimeConfig();
    if (!config.supabaseUrl || !config.supabaseAnonKey) return false;
    client = await createSupabaseClient(config);
    if (!client) return false;
    repository = createSupabaseRepository(client, () => readState());
    await repository.getUser();
    return true;
  } catch (_) {
    client = null;
    repository = null;
    return false;
  }
}

async function sync(state) {
  if (!state || busy) return;
  busy = true;
  try {
    const changed = ensureDailySnapshot(state);
    if (changed) {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
    }

    await connect();
    if (repository) {
      await repository.saveState(state);
    }
  } catch (_) {
    // Local storage remains the immediate source of truth when the backend is unavailable.
  } finally {
    busy = false;
  }
}

async function tick() {
  if (busy) return;
  const state = readState();
  if (!state || state.version !== 1) return;
  const sig = signature(state);
  const shouldSync = sig !== lastStateSignature || !Array.isArray(state.snapshots) || !state.snapshots.some(s => String(s.date || "").slice(0, 10) === today());
  if (!shouldSync) return;
  lastStateSignature = sig;
  await sync(state);
  lastStateSignature = signature(readState());
}

setTimeout(tick, 800);
setInterval(tick, 1200);
window.addEventListener("storage", event => {
  if (event.key === LOCAL_STORAGE_KEY) tick();
});
