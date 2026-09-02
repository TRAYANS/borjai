import test from "node:test";
import assert from "node:assert/strict";
import { financialEngine as e } from "../src/financial-engine.js";

const tx=[
 {date:"2026-08-01",type:"income",amount:2000,merchant:"Nómina"},
 {date:"2026-08-05",type:"expense",amount:-100,category_name:"Alimentacion",merchant:"Super"},
 {date:"2026-09-01",type:"income",amount:2000,merchant:"Nómina"},
 {date:"2026-09-02",type:"expense",amount:-120,category_name:"Alimentacion",merchant:"Super"}
];

test("monthlyTotals separates income and expenses",()=>assert.deepEqual(e.monthlyTotals(tx,"2026-09"),{expenses:120,income:2000,net:1880}));
test("transfers are not expenses",()=>assert.equal(e.monthlyTotals([{date:"2026-09-01",type:"transfer",amount:-500}],"2026-09").expenses,0));
test("balances calculates net worth",()=>assert.deepEqual(e.balances({accounts:[{current_balance:1000}],assets:[{current_value:5000}],liabilities:[{outstanding_balance:700}]}),{liquid:1000,investedAssets:5000,debt:700,netWorth:5300}));
test("health is zero only when there is no economic data",()=>assert.equal(e.healthScore({transactions:[],accounts:[],assets:[],liabilities:[]}).score,0));
test("affordability keeps negative remaining cash possible",()=>assert.equal(e.affordability({accounts:[{current_balance:100}],transactions:[]},150).after,-50));
test("duplicates returns a pair, not just a count",()=>assert.equal(e.duplicates([{date:"2026-09-01",type:"expense",amount:-10,merchant:"X"},{date:"2026-09-01",type:"expense",amount:-10,merchant:"X"}]).length,1));
