export function createMarketApi(supabaseClient) {
  async function quotes(ids = []) {
    if (!supabaseClient) throw new Error("Supabase no disponible.");

    const { data, error } = await supabaseClient.functions.invoke("market-data", {
      body: { ids },
      headers: { "Content-Type": "application/json" }
    });

    if (error) throw error;
    return data;
  }

  return { quotes };
}
