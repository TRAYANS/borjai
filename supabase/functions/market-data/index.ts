import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

const ALPHA_URL = "https://www.alphavantage.co/query";
const COINGECKO_URL = "https://api.coingecko.com/api/v3";

const MARKET_SOURCES: Record<string, { source: string; symbol: string }> = {
  sp500: { source: "av", symbol: "SPY" },
  nasdaq: { source: "av", symbol: "QQQ" },
  dow: { source: "av", symbol: "DIA" },
  russell: { source: "av", symbol: "IWM" },
  eurostoxx: { source: "av", symbol: "FEZ" },
  spain: { source: "av", symbol: "EWP" },
  germany: { source: "av", symbol: "EWG" },
  france: { source: "av", symbol: "EWQ" },
  italy: { source: "av", symbol: "EWI" },
  uk: { source: "av", symbol: "EWU" },
  japan: { source: "av", symbol: "EWJ" },
  china: { source: "av", symbol: "FXI" },
  hongkong: { source: "av", symbol: "EWH" },
  southkorea: { source: "av", symbol: "EWY" },
  taiwan: { source: "av", symbol: "EWT" },
  india: { source: "av", symbol: "INDA" },
  emerging: { source: "av", symbol: "EEM" },
  brazil: { source: "av", symbol: "EWZ" },
  latin: { source: "av", symbol: "ILF" },
  world: { source: "av", symbol: "URTH" },
  allworld: { source: "av", symbol: "ACWI" },
  btc: { source: "cg", symbol: "bitcoin" },
  eth: { source: "cg", symbol: "ethereum" }
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

async function alphaVantage(symbol: string) {
  const key = Deno.env.get("ALPHA_VANTAGE_API_KEY");
  if (!key) throw new Error("ALPHA_VANTAGE_API_KEY no está configurada en Supabase.");

  const url = new URL(ALPHA_URL);
  url.searchParams.set("function", "GLOBAL_QUOTE");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("apikey", key);

  const response = await fetch(url);
  if (!response.ok) throw new Error(`Alpha Vantage HTTP ${response.status}`);

  const data = await response.json();
  if (data.Note) throw new Error("Límite de Alpha Vantage alcanzado.");
  if (data.Information) throw new Error(data.Information);

  const quote = data["Global Quote"];
  if (!quote?.["05. price"]) throw new Error(`Cotización no disponible para ${symbol}.`);

  return {
    price: Number(quote["05. price"]),
    change: Number(String(quote["10. change percent"] || "").replace("%", "")),
    source: "alpha_vantage",
    symbol
  };
}

async function coinGecko(id: string) {
  const url = new URL(`${COINGECKO_URL}/simple/price`);
  url.searchParams.set("ids", id);
  url.searchParams.set("vs_currencies", "eur");
  url.searchParams.set("include_24hr_change", "true");

  const response = await fetch(url);
  if (!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`);

  const data = await response.json();
  const quote = data[id];
  if (!quote) throw new Error(`Cotización no disponible para ${id}.`);

  return {
    price: Number(quote.eur),
    change: Number(quote.eur_24h_change),
    source: "coingecko",
    symbol: id
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "GET") return json({ error: "Método no permitido" }, 405);

  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return json({ error: "Autenticación requerida" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Sesión no válida" }, 401);

  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") || "").split(",").map((id) => id.trim()).filter(Boolean);
  const requested = ids.length ? ids : Object.keys(MARKET_SOURCES);

  const results = await Promise.all(requested.map(async (id) => {
    const market = MARKET_SOURCES[id];
    if (!market) return { id, error: "Mercado no soportado" };

    try {
      const quote = market.source === "cg"
        ? await coinGecko(market.symbol)
        : await alphaVantage(market.symbol);
      return { id, ...quote, fetchedAt: new Date().toISOString() };
    } catch (error) {
      return { id, error: error instanceof Error ? error.message : "Error de proveedor" };
    }
  }));

  return json({
    userId: user.id,
    fetchedAt: new Date().toISOString(),
    data: results
  });
});
