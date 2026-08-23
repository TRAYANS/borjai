import test from "node:test";
import assert from "node:assert/strict";
import { metrics, wealth, recommendation } from "../src/finance.js";
import { parseCsv } from "../src/importer.js";

const formatters = {
  money: function(n) { return n + " EUR"; },
  percent: function(n) { return Math.round(n * 1000) / 10 + "%"; }
};

function baseState(overrides) {
  return Object.assign({
    version: 1,
    profile: { name: "Borja", risk: "Moderado", emergency: 3, contribution: 300 },
    accounts: [{ id: "bank", name: "Banco", kind: "bank", balance: 1000 }],
    assets: [{ id: "fund", name: "Fondo", group: "Inversiones", type: "ETF", value: 500, cost: 450 }],
    debts: [{ id: "loan", name: "Prestamo", balance: 200 }],
    transactions: [
      { id: "i1", date: "2026-08-01", amount: 2000, type: "income", category: "Ingresos", accountId: "bank" },
      { id: "e1", date: "2026-08-03", amount: -1200, type: "expense", category: "Vivienda", accountId: "bank" },
      { id: "b1", date: "2026-07-03", amount: -300, type: "expense", category: "Ocio", accountId: "bank" }
    ],
    goals: [],
    imports: [],
    snapshots: []
  }, overrides || {});
}

test("calcula patrimonio neto con cuentas, activos y deuda", function() {
  assert.equal(wealth(baseState()), 1300);
});

test("calcula ahorro y tasa de ahorro mensual", function() {
  const result = metrics(baseState(), "2026-08");
  assert.equal(result.income, 2000);
  assert.equal(result.expense, 1200);
  assert.equal(result.savings, 800);
  assert.equal(result.rate, 0.4);
});

test("la tasa de ahorro es 0 si no hay ingresos", function() {
  const result = metrics(baseState({ transactions: [{ id: "e1", date: "2026-08-03", amount: -100, type: "expense", category: "Ocio", accountId: "bank" }] }), "2026-08");
  assert.equal(result.income, 0);
  assert.equal(result.savings, -100);
  assert.equal(result.rate, 0);
});

test("parsea CSV con punto y coma, importes europeos y categoria automatica", function() {
  const rows = parseCsv("fecha;concepto;importe\n23/08/2026;MERCADONA;-45,30\n24/08/2026;Nomina;2.000,00", "extracto.csv", "bank", new Date("2026-08-23T00:00:00Z"));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    date: "2026-08-23",
    merchant: "MERCADONA",
    description: "Importado desde extracto.csv",
    amount: -45.3,
    type: "expense",
    category: "Alimentacion",
    accountId: "bank"
  });
  assert.equal(rows[1].amount, 2000);
  assert.equal(rows[1].type, "income");
});

test("CSV sin columnas requeridas falla de forma explicita", function() {
  assert.throws(function() {
    parseCsv("fecha;nota\n23/08/2026;Sin importe", "mal.csv", "bank");
  }, /columnas de concepto e importe/);
});

test("recomienda mantener liquidez si la reserva no esta cubierta", function() {
  const state = baseState({ accounts: [{ id: "bank", name: "Banco", kind: "bank", balance: 100 }] });
  const result = recommendation(state, "2026-08", formatters);
  assert.equal(result.main, "Mantener efectivo");
});

test("recomienda no invertir si el ahorro es negativo", function() {
  const state = baseState({
    accounts: [{ id: "bank", name: "Banco", kind: "bank", balance: 10000 }],
    transactions: [
      { id: "i1", date: "2026-08-01", amount: 1000, type: "income", category: "Ingresos", accountId: "bank" },
      { id: "e1", date: "2026-08-03", amount: -1500, type: "expense", category: "Ocio", accountId: "bank" }
    ]
  });
  const result = recommendation(state, "2026-08", formatters);
  assert.equal(result.main, "No invertir hoy");
});

test("recomienda aportar si hay ahorro y reserva suficiente", function() {
  const state = baseState({ accounts: [{ id: "bank", name: "Banco", kind: "bank", balance: 10000 }] });
  const result = recommendation(state, "2026-08", formatters);
  assert.equal(result.main, "Aportar 280 EUR");
});
