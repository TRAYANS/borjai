import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = readFileSync(new URL("../src/db/schema.sql", import.meta.url), "utf8");

test("el esquema Supabase es multiusuario y activa RLS", function() {
  ["accounts", "categories", "transactions", "assets", "liabilities", "investments", "goals", "imports", "wealth_snapshots"].forEach(function(table) {
    assert.match(schema, new RegExp("create table if not exists public\\." + table));
    if (table !== "categories") assert.match(schema, new RegExp(table + "[\\s\\S]*user_id uuid not null references auth\\.users"));
    assert.match(schema, new RegExp("alter table public\\." + table + " enable row level security"));
  });
});

test("las politicas RLS filtran por auth.uid", function() {
  assert.match(schema, /for select using \(auth\.uid\(\) = user_id\)/);
  assert.match(schema, /for insert with check \(auth\.uid\(\) = user_id\)/);
  assert.match(schema, /for update using \(auth\.uid\(\) = user_id\) with check \(auth\.uid\(\) = user_id\)/);
  assert.match(schema, /for delete using \(auth\.uid\(\) = user_id\)/);
});

test("el esquema prepara transferencias, vivienda e hipoteca sin implementarlas", function() {
  assert.match(schema, /'transfer'/);
  assert.match(schema, /'real_estate'/);
  assert.match(schema, /'mortgage'/);
});
