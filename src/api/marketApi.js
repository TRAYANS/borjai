export function createMarketApi(supabaseClient) {
  async function quotes(ids = []) {
    if (!supabaseClient) throw new Error("Supabase no disponible.");

    const { data, error } = await supabaseClient.functions.invoke("market-data", {
      method: "GET",
      body: undefined,
      headers: { "Content-Type": "application/json" },
      queryParams: ids.length ? { ids: ids.join(",") } : undefined
    });

    if (error) throw error;
    return data;
  }

  return { quotes };
}
