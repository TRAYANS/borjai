import test from "node:test";
import assert from "node:assert/strict";
import { createFinancialApi } from "../src/api/financialApi.js";
import { buildFinancialContext } from "../src/financial-context.js";
import { dedupeTransactions, stateCounts, toDatabaseRows, validateLegacyState } from "../src/repositories/stateMapper.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem: function(key) { return data.has(key) ? data.get(key) : null; },
    setItem: function(key, value) { data.set(key, String(value)); },
    removeItem: function(key) { data.delete(key); }
  };
}

function sampleState() {
  return {
    version: 1,
    profile: { name: "Borja", risk: "Moderado", emergency: 3, contribution: 300 },
    accounts: [
      { id: "bank", name: "Banco", kind: "bank", balance: 3000 },
      { id: "cash", name: "Efectivo", kind: "cash", balance: 200 }
    ],
    assets: [{ id: "etf", name: "ETF", ticker: "IWDA", group: "Inversiones", type: "ETF", value: 1000, cost: 900 }],
    debts: [{ id: "loan", name: "Prestamo", type: "loan", balance: 250 }],
    transactions: [
      { id: "i1", date: "2026-08-01", amount: 2000, type: "income", category: "Ingresos", accountId: "bank", merchant: "Nomina" },
      { id: "e1", date: "2026-08-02", amount: -800, type: "expense", category: "Vivienda", accountId: "bank", merchant: "Alquiler" },
      { id: "tr1", date: "2026-08-03", amount: -100, type: "transfer", category: "Transferencias", accountId: "bank", destinationAccountId: "cash", merchant: "Traspaso" },
      { id: "tr1", date: "2026-08-03", amount: -100, type: "transfer", category: "Transferencias", accountId: "bank", destinationAccountId: "cash", merchant: "Traspaso" }
    ],
    goals: [{ id: "g1", name: "Reserva", target: 3000, current: 1200, date: "2026-12-01", priority: "Alta" }],
    imports: [],
    snapshots: [{ month: "2026-08", value: 3950 }]
  };
}

test("el repositorio local conserva compatibilidad con borjai:mvp:v1", async function() {
  const storage = memoryStorage();
  const state = sampleState();
  storage.setItem("borjai:mvp:v1", JSON.stringify(state));
  const api = await createFinancialApi({ localKey: "borjai:mvp:v1", fallbackFactory: sampleState, storage: storage, config: { backendMode: "local" } });
  const loaded = await api.load();
  assert.equal(loaded.accounts.length, 2);
  assert.equal(api.backendStatus().mode, "local");
});

test("valida el estado legacy antes de migrar", function() {
  const result = validateLegacyState({ version: 1, accounts: [], assets: [], debts: [], goals: [], transactions: [{ id: "bad", amount: "x" }] });
  assert.equal(result.ok, false);
  assert.match(result.errors.join(" "), /fecha/);
  assert.match(result.errors.join(" "), /importe/);
});

test("la migracion deduplica movimientos por legacy_id", function() {
  const rows = toDatabaseRows(sampleState(), "user-1");
  assert.equal(dedupeTransactions(sampleState().transactions).length, 3);
  assert.equal(rows.transactions.length, 3);
  assert.equal(rows.transactions.find(function(t) { return t.legacy_id === "tr1"; }).type, "transfer");
});

test("stateCounts permite verificar una migracion", function() {
  assert.deepEqual(stateCounts(sampleState()), {
    accounts: 2,
    transactions: 4,
    assets: 1,
    liabilities: 1,
    goals: 1,
    imports: 0,
    wealthSnapshots: 1
  });
});

test("financialContext entrega datos estructurados para IA futura", function() {
  const context = buildFinancialContext(sampleState(), "2026-08", {
    money: function(n) { return n + " EUR"; },
    percent: function(n) { return n; }
  });
  assert.equal(context.patrimonio.neto, 3950);
  assert.equal(context.ingresos, 2000);
  assert.equal(context.gastos, 800);
  assert.equal(context.ahorro, 1200);
  assert.equal(context.categoriasGasto[0].categoria, "Vivienda");
  assert.equal(context.inversiones.total, 1000);
});
