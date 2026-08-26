import test from "node:test";
import assert from "node:assert/strict";
import { createServerApiRepository } from "../src/repositories/serverApiRepository.js";

test("serverApiRepository carga y guarda estado mediante /api/state", async function() {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async function(url, init = {}) {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      async json() {
        return { ok: true, state: { version: 1, accounts: [], assets: [], debts: [], transactions: [], goals: [], imports: [], snapshots: [] } };
      }
    };
  };

  try {
    const repo = createServerApiRepository({ getAccessToken: async () => "token" });
    await repo.load();
    await repo.saveState({ version: 1, accounts: [], assets: [], debts: [], transactions: [], goals: [], imports: [], snapshots: [] });
    assert.equal(calls[0].url, "/api/state");
    assert.equal(calls[0].init.headers.Authorization, "Bearer token");
    assert.equal(calls[1].init.method, "PUT");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("serverApiRepository no oculta errores del backend", async function() {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async function() {
    return {
      ok: false,
      status: 503,
      async json() { return { ok: false, error: "Backend no disponible." }; }
    };
  };

  try {
    const repo = createServerApiRepository({ getAccessToken: async () => "" });
    await assert.rejects(() => repo.load(), /Backend no disponible/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
