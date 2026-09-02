const YAHOO = "https://query1.finance.yahoo.com/v8/finance/chart/";
const COINGECKO = "https://api.coingecko.com/api/v3";
const CACHE = new Map();
const TTL = 30_000;

function allowedSymbol(symbol) { return /^[A-Za-z0-9_.^=-]{1,30}$/.test(symbol || ""); }
function fetchUrl(base, params) {
  const url = new URL(base);
  Object.entries(params || {}).forEach(([k,v]) => url.searchParams.set(k, String(v)));
  return url;
}
function requestQuery(req) {
  const raw = String(req.url || "");
  return new URL(raw, "http://borjai.local").searchParams;
}

export default async function handler(req,res) {
  if (req.method !== "GET") return res.status(405).json({error:"Method not allowed"});
  const query=requestQuery(req), symbol=String(query.get("symbol")||""), kind=String(query.get("kind")||"yahoo");
  if (!symbol || !allowedSymbol(symbol)) return res.status(400).json({error:"Símbolo no válido."});
  const cacheKey=`${kind}:${symbol}`, hit=CACHE.get(cacheKey);
  if (hit && Date.now()-hit.at<TTL) return res.status(200).json(hit.data);
  try {
    let data;
    if (kind === "crypto") {
      const url=fetchUrl(`${COINGECKO}/simple/price`,{ids:symbol,vs_currencies:"eur",include_24hr_change:"true"});
      const response=await fetch(url,{headers:{accept:"application/json"}});
      if(!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`);
      const payload=await response.json(), row=payload?.[symbol];
      if(!row) throw new Error("Cotización cripto no disponible.");
      data={price:Number(row.eur),change:Number(row.eur_24h_change),currency:"EUR",source:"coingecko"};
    } else {
      const url=new URL(`${YAHOO}${encodeURIComponent(symbol)}`);
      url.searchParams.set("range","1d"); url.searchParams.set("interval","5m"); url.searchParams.set("includePrePost","false");
      const response=await fetch(url,{headers:{accept:"application/json"}});
      if(!response.ok) throw new Error(`Yahoo HTTP ${response.status}`);
      const payload=await response.json(), meta=payload?.chart?.result?.[0]?.meta;
      if(!meta) throw new Error("Cotización Yahoo no disponible.");
      const price=Number(meta.regularMarketPrice ?? meta.previousClose), previous=Number(meta.chartPreviousClose ?? meta.previousClose);
      if(!Number.isFinite(price)) throw new Error("Precio no disponible.");
      data={price,change:Number.isFinite(previous)&&previous?((price-previous)/previous)*100:null,currency:meta.currency||"",source:"yahoo"};
    }
    CACHE.set(cacheKey,{at:Date.now(),data});
    res.setHeader("Cache-Control","s-maxage=30, stale-while-revalidate=120");
    return res.status(200).json(data);
  } catch(error) { return res.status(502).json({error:error?.message||"Fuente de mercado no disponible."}); }
}
