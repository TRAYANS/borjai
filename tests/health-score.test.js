import test from "node:test";
import assert from "node:assert/strict";
import { financialEngine as e } from "../src/financial-engine.js";

test("healthScore returns zero for a completely empty financial state",()=>assert.equal(e.healthScore({transactions:[],accounts:[],assets:[],liabilities:[],goals:[]}).score,0));
test("healthScore uses profile emergency months and normalized goal fields",()=>{
  const h=e.healthScore({profile:{emergency:3},transactions:[{date:"2026-09-01",type:"income",amount:2000},{date:"2026-09-02",type:"expense",amount:-500}],accounts:[{current_balance:1500}],assets:[],liabilities:[],goals:[{target_amount:1000,current_amount:500}]},"2026-09");
  assert.equal(h.metrics.income,2000); assert.equal(h.metrics.expense,500); assert.equal(h.target,1500); assert.equal(h.liquidityMonths,3); assert.equal(h.parts.length,7);
});
