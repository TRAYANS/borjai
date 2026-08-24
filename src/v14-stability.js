import { LOCAL_STORAGE_KEY, hasSupabaseConfig, loadRuntimeConfig } from "./config.js";
import { createSupabaseClient } from "./db/supabaseClient.js";
import { createSupabaseRepository } from "./repositories/supabaseRepository.js";

const SYNC_KEY = "borjai:v14:last-sync";
const MAX_DAYS = 1825;
let syncing = false;
let timer = null;
let originalSetItem = null;

function readLocal() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    const state = raw ? JSON.parse(raw) : null;
    return state && state.version === 1 ? state : null;
  } catch (_) { return null; }
}
function writeLocal(state) {
  if (!originalSetItem) return;
  syncing = true;
  try { originalSetItem.call(localStorage, LOCAL_STORAGE_KEY, JSON.stringify(state)); }
  finally { syncing = false; }
}
function isoToday() { return new Date().toISOString().slice(0,10); }
function hasTodaySnapshot(state) {
  const today = isoToday();
  return Array.isArray(state?.snapshots) && state.snapshots.some(s => String(s.date || (s.month ? `${s.month}-01` : "")).slice(0,10) === today);
}
function calculateWealth(state) {
  const accounts = (state.accounts || []).reduce((sum,a) => sum + Number(a.balance || 0),0);
  const assets = (state.assets || []).reduce((sum,a) => sum + Number(a.value || 0),0);
  const debts = (state.debts || []).reduce((sum,d) => sum + Number(d.balance || d.outstandingBalance || 0),0);
  return accounts + assets - debts;
}
function withDailySnapshot(state) {
  const date = isoToday(), month = date.slice(0,7), value = calculateWealth(state);
  const snapshots = Array.isArray(state.snapshots) ? [...state.snapshots] : [];
  const found = snapshots.find(s => String(s.date || s.month || "").slice(0,10) === date);
  if (found) Object.assign(found,{date,month,value,source:"daily-sync"});
  else snapshots.push({date,month,value,source:"daily-sync"});
  const cutoff = new Date(); cutoff.setHours(0,0,0,0); cutoff.setDate(cutoff.getDate()-MAX_DAYS);
  const cutoffIso = cutoff.toISOString().slice(0,10);
  snapshots.sort((a,b) => String(a.date || a.month).localeCompare(String(b.date || b.month)));
  state.snapshots = snapshots.filter(s => String(s.date || (s.month ? `${s.month}-01` : "")).slice(0,10) >= cutoffIso);
  return state;
}
function counts(state) {
  return { transactions:(state.transactions||[]).length, accounts:(state.accounts||[]).length, assets:(state.assets||[]).length, goals:(state.goals||[]).length, imports:(state.imports||[]).length, snapshots:(state.snapshots||[]).length };
}
function localIsNewer(local,remote) {
  const a=counts(local), b=counts(remote);
  return a.transactions>b.transactions || a.accounts>b.accounts || a.assets>b.assets || a.goals>b.goals || a.imports>b.imports || a.snapshots>b.snapshots;
}
async function getClient() {
  const config = await loadRuntimeConfig();
  if (!hasSupabaseConfig(config)) return null;
  const client = await createSupabaseClient(config);
  const session = await client.auth.getSession();
  if (session.data?.session?.access_token) window.BORJAI_SESSION_TOKEN = session.data.session.access_token;
  return client;
}
async function syncState(state) {
  if (syncing || !state || state.version !== 1) return;
  syncing = true;
  try {
    const client = await getClient();
    if (!client) return;
    const prepared = withDailySnapshot(JSON.parse(JSON.stringify(state)));
    writeLocal(prepared);
    const repo = createSupabaseRepository(client, () => prepared);
    await repo.saveState(prepared);
    localStorage.setItem(SYNC_KEY, new Date().toISOString());
  } catch (error) {
    localStorage.setItem(SYNC_KEY, JSON.stringify({error:error?.message || String(error),at:new Date().toISOString()}));
  } finally { syncing = false; }
}
function scheduleSync(state) { clearTimeout(timer); timer = setTimeout(() => syncState(state), 350); }
async function reconcileOnBoot() {
  const local = readLocal();
  try {
    const client = await getClient();
    if (!client) return;
    const repo = createSupabaseRepository(client, () => local || {});
    const remote = await repo.load();
    if (local && localIsNewer(local,remote)) await repo.saveState(withDailySnapshot(local));
    else if (!local || !localIsNewer(local,remote)) writeLocal(withDailySnapshot(remote));
  } catch (_) {}
}
function installStorageHook() {
  if (originalSetItem || !globalThis.localStorage) return;
  try {
    originalSetItem = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function(key,value) {
      originalSetItem(key,value);
      if (!syncing && key===LOCAL_STORAGE_KEY) {
        try { const state=JSON.parse(value); if (state?.version===1) scheduleSync(state); } catch (_) {}
      }
    };
  } catch (_) {
    originalSetItem = null;
  }
}
function start() {
  installStorageHook();
  reconcileOnBoot();
  setInterval(() => {
    const state = readLocal();
    if (state && !hasTodaySnapshot(state)) scheduleSync(state);
  }, 10*60*1000);
  document.addEventListener("visibilitychange",() => {
    if (!document.hidden) { const state=readLocal(); if (state && !hasTodaySnapshot(state)) scheduleSync(state); }
  });
}
window.BORJAI_V14_STABILITY = { sync:() => syncState(readLocal()) };
start();
