import test from "node:test";
import assert from "node:assert/strict";
import { filterWealthRows, summarizeWealthRows, WEALTH_PERIODS } from "../src/wealth-dashboard.js";

const now = new Date("2026-08-26T12:00:00Z");
const rows = [
  { date: "2020-01-01", value: 1000 },
  { date: "2021-08-27", value: 2000 },
  { date: "2023-08-27", value: 3000 },
  { date: "2025-08-26", value: 4000 },
  { date: "2026-02-27", value: 4500 },
  { date: "2026-05-28", value: 5000 },
  { date: "2026-07-27", value: 5200 },
  { date: "2026-08-19", value: 5400 },
  { date: "2026-08-25", value: 5500 },
  { date: "2026-08-26", value: 5600 }
];

test("wealth dashboard define todos los periodos requeridos y sus textos", function() {
  assert.deepEqual(WEALTH_PERIODS.map((p) => p[1]), ["1D", "1S", "1M", "3M", "6M", "1A", "3A", "5A", "MAX"]);
  assert.deepEqual(WEALTH_PERIODS.map((p) => p[3]), [
    "Último día",
    "Última semana",
    "Último mes",
    "Últimos 3 meses",
    "Últimos 6 meses",
    "Último año",
    "Últimos 3 años",
    "Últimos 5 años",
    "Todo el histórico"
  ]);
});

test("wealth dashboard cambia realmente los datos por periodo", function() {
  const expectedFirstDate = {
    "1d": "2026-08-25",
    "1w": "2026-08-19",
    "1m": "2026-07-27",
    "3m": "2026-05-28",
    "6m": "2026-02-27",
    "1y": "2025-08-26",
    "3y": "2023-08-27",
    "5y": "2021-08-27",
    max: "2020-01-01"
  };

  for (const period of WEALTH_PERIODS) {
    const filtered = filterWealthRows(rows, period[0], now);
    assert.equal(filtered[0].date, expectedFirstDate[period[0]]);
    assert.equal(filtered.at(-1).date, "2026-08-26");
  }
});

test("wealth dashboard calcula variacion absoluta y porcentual", function() {
  const filtered = filterWealthRows(rows, "1m", now);
  const summary = summarizeWealthRows(filtered);
  assert.equal(summary.first, 5200);
  assert.equal(summary.last, 5600);
  assert.equal(summary.change, 400);
  assert.equal(Math.round(summary.changePct * 10000) / 10000, 0.0769);
});

test("wealth dashboard informa falta de datos suficientes", function() {
  assert.equal(summarizeWealthRows([]), null);
  const onePoint = summarizeWealthRows([{ date: "2026-08-26", value: 5600 }]);
  assert.equal(onePoint.change, 0);
  assert.equal(onePoint.changePct, 0);
});
