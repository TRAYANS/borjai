const num=(v)=>Number.isFinite(Number(v))?Number(v):0;
const ym=(v)=>String(v||"").slice(0,7);
const monthKey=(d=new Date())=>d.toISOString().slice(0,7);
const abs=(v)=>Math.abs(num(v));
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const normalizeName=(v)=>String(v||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim().toLowerCase().replace(/\s+/g," ");
const dateValue=(v)=>new Date(`${String(v||"").slice(0,10)}T12:00:00`).getTime();
export function classifyTransactions(transactions=[]){return{expenses:transactions.filter(t=>["expense","fee"].includes(t.type)),income:transactions.filter(t=>["income","dividend"].includes(t.type)),transfers:transactions.filter(t=>["transfer","internal_transfer"].includes(t.type))};}
export function monthlyTotals(transactions=[],month=monthKey()){const g=classifyTransactions(transactions);const expenses=g.expenses.filter(t=>ym(t.date)===month).reduce((s,t)=>s+abs(t.amount),0);const income=g.income.filter(t=>ym(t.date)===month).reduce((s,t)=>s+abs(t.amount),0);return{expenses,income,net:income-expenses};}
export function balances(data={}){const accounts=data.accounts||[],assets=data.assets||[],liabilities=data.liabilities||data.debts||[];const liquid=accounts.reduce((s,a)=>s+num(a.current_balance??a.balance),0),investedAssets=assets.reduce((s,a)=>s+num(a.current_value??a.value),0),debt=liabilities.reduce((s,l)=>s+num(l.outstanding_balance??l.current_balance??l.balance),0);return{liquid,investedAssets,debt,netWorth:liquid+investedAssets-debt};}
export function historicalMonthlyExpenses(transactions=[],months=3){const out=[],d=new Date();d.setDate(1);for(let i=0;i<months;i++){const key=monthKey(d);out.push({month:key,...monthlyTotals(transactions,key)});d.setMonth(d.getMonth()-1);}return out;}
export function recurringPayments(transactions=[]){const groups=new Map();for(const t of classifyTransactions(transactions).expenses){const name=normalizeName(t.merchant||t.description||"Movimiento"),amount=abs(t.amount);if(!name||!amount||!t.date)continue;const list=groups.get(name)||[];list.push({date:String(t.date).slice(0,10),amount,original:t});groups.set(name,list);}return[...groups.values()].map(list=>{list.sort((a,b)=>dateValue(a.date)-dateValue(b.date));if(list.length<2)return null;const gaps=[];for(let i=1;i<list.length;i++){const gap=(dateValue(list[i].date)-dateValue(list[i-1].date))/86400000;if(gap>0)gaps.push(gap);}if(!gaps.length)return null;const avgGap=gaps.reduce((s,v)=>s+v,0)/gaps.length;if(avgGap<20||avgGap>40)return null;const avgAmount=list.reduce((s,v)=>s+v.amount,0)/list.length,last=list.at(-1),next=new Date(dateValue(last.date)+avgGap*86400000);return{merchant:last.original.merchant||last.original.description||"Movimiento",category:last.original.category_name||"Otros",amount:avgAmount,avgGap,next,occurrences:list.length};}).filter(Boolean).sort((a,b)=>b.amount-a.amount);}
export function anomalies(transactions=[],month=monthKey()){const groups=new Map();for(const t of classifyTransactions(transactions).expenses){const key=normalizeName(t.category_name||"Otros"),arr=groups.get(key)||[];arr.push({date:t.date,amount:abs(t.amount),merchant:t.merchant||t.description||"Movimiento",category:t.category_name||"Otros"});groups.set(key,arr);}const out=[];groups.forEach(arr=>{const hist=arr.filter(x=>ym(x.date)!==month).map(x=>x.amount);if(hist.length<3)return;const avg=hist.reduce((s,v)=>s+v,0)/hist.length;arr.filter(x=>ym(x.date)===month&&x.amount>Math.max(avg*2.2,avg+50)).forEach(x=>out.push({...x,average:avg}));});return out.sort((a,b)=>b.amount-a.amount).slice(0,10);}
export function duplicates(transactions=[]){const seen=new Map(),out=[];for(const t of transactions){const account=String(t.account_id??t.account_legacy_id??"");const key=[String(t.date||"").slice(0,10),account,String(t.currency||"EUR").toUpperCase(),String(t.type||""),Math.round(num(t.amount)*100),normalizeName(t.merchant||t.description)].join("|");if(seen.has(key)){const first=seen.get(key);if(!(first.id&&t.id&&first.id===t.id))out.push({first,duplicate:t});}else seen.set(key,t);}return out;}

// Única fuente de verdad para la salud financiera. Inicio, Borjai 2.0,
// monitor y futuras vistas deben utilizar esta función para evitar divergencias.
export function healthScore(data={},month=monthKey()){
  const totals=monthlyTotals(data.transactions||[],month),b=balances(data),profile=data.profile||{},emergencyMonths=Math.max(1,num(profile.emergency??profile.emergency_months??3));
  const expenseBase=totals.expenses,reserveTarget=expenseBase>0?expenseBase*emergencyMonths:0,liquidityMonths=expenseBase>0?b.liquid/expenseBase:0,debtRatio=b.netWorth>0?b.debt/b.netWorth:(b.debt>0?1:0),spendingRatio=totals.income>0?totals.expenses/totals.income:(totals.expenses>0?1:0);
  const assets=data.assets||[],invested=assets.reduce((s,a)=>{const group=normalizeName(a.group||a.category||a.type);return s+((group.includes("inversion")||group.includes("cripto")||group.includes("oro")||group.includes("metales"))?num(a.current_value??a.value):0)},0),investedRatio=b.netWorth>0?invested/b.netWorth:0;
  const allocations=new Map();for(const a of data.accounts||[]){const k=normalizeName(a.kind||a.type||"bancos");allocations.set(k,(allocations.get(k)||0)+num(a.current_balance??a.balance));}for(const a of assets){const k=normalizeName(a.group||a.category||a.type||"otros activos");allocations.set(k,(allocations.get(k)||0)+num(a.current_value??a.value));}const maxAllocation=b.netWorth>0?[...allocations.values()].reduce((m,v)=>Math.max(m,Math.max(0,v)/b.netWorth),0):0;
  const goals=data.goals||[],validGoals=goals.filter(g=>num(g.target_amount??g.target)>0),progress=validGoals.length?validGoals.reduce((s,g)=>s+clamp(num(g.current_amount??g.current)/num(g.target_amount??g.target),0,1),0)/validGoals.length:0;
  const crypto=assets.filter(a=>{const g=normalizeName(a.group||a.category||a.type);return g.includes("cripto")||g.includes("crypto")}).reduce((s,a)=>s+num(a.current_value??a.value),0),cryptoRatio=b.netWorth>0?crypto/b.netWorth:0;
  const linear=(v,bad,good)=>v<=bad?0:v>=good?100:(v-bad)/(good-bad)*100;
  const inverse=(v,good,bad)=>v<=good?100:v>=bad?0:(bad-v)/(bad-good)*100;
  const parts=[
    {label:"Ahorro",score:totals.income>0?linear(totals.net/totals.income,0,.20):0},
    {label:"Liquidez",score:expenseBase>0?linear(liquidityMonths,0,emergencyMonths):0},
    {label:"Inversion",score:b.netWorth>0?linear(investedRatio,.05,.50):0},
    {label:"Diversificacion",score:b.netWorth>0?inverse(maxAllocation,.30,.70):0},
    {label:"Gastos",score:totals.income>0?inverse(spendingRatio,.70,1):0},
    {label:"Deuda",score:b.debt<=0?100:(b.netWorth>0?inverse(debtRatio,.10,.50):0)},
    {label:"Objetivos",score:validGoals.length?progress*100:0}
  ];
  if(cryptoRatio>.15)parts[3].score=clamp(parts[3].score-clamp((cryptoRatio-.15)/.35*25,0,25),0,100);
  const hasEconomic=Boolean((data.transactions||[]).length||b.liquid||b.investedAssets||b.debt||validGoals.length);
  if(!hasEconomic)return{score:0,savingsRate:0,monthsLiquidity:0,liquidityMonths:0,debtRatio:0,spendingRatio:0,investedRatio:0,target:0,reserveTarget:0,confidence:"baja",label:"Sin datos",metrics:totals,parts};
  const score=Math.round(parts.reduce((s,p)=>s+p.score,0)/parts.length),populated=[totals.income>0,totals.expenses>0,b.netWorth!==0,b.debt>0,validGoals.length>0].filter(Boolean).length;
  return{score:clamp(score,0,100),savingsRate:totals.income>0?Math.max(0,totals.net/totals.income):0,monthsLiquidity:liquidityMonths,liquidityMonths,target:reserveTarget,reserveTarget,debtRatio,spendingRatio,investedRatio,confidence:populated>=4?"alta":populated>=2?"media":"baja",label:"Calculada con datos reales",metrics:totals,parts};
}

export function affordability(data={},amount=0,now=new Date()){const b=balances(data),purchase=Math.max(0,num(amount)),today=dateValue(now.toISOString().slice(0,10)),recurring=recurringPayments(data.transactions||[]),expectedNext=recurring.filter(r=>dateValue(r.next)>=today).reduce((s,r)=>s+r.amount,0),available=b.liquid,after=available-purchase;const hist=historicalMonthlyExpenses(data.transactions||[],3).slice(1).map(x=>x.expenses).filter(Boolean),avg=hist.length?hist.reduce((s,v)=>s+v,0)/hist.length:monthlyTotals(data.transactions||[]).expenses,threshold=Math.max(0,avg*1.5),bufferAfter=after-expectedNext;return{gross:b.liquid,recurringReserve:expectedNext,available,after,bufferAfter,affordable:after>=threshold&&bufferAfter>=0,caution:after>=0&&bufferAfter<0?true:after>=0&&after<threshold};}
export const financialEngine={classifyTransactions,monthlyTotals,balances,historicalMonthlyExpenses,recurringPayments,anomalies,duplicates,healthScore,affordability};
