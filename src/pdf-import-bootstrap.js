const CHUNKS = [
  "/data/borjai-import-01.txt",
  "/data/borjai-import-02.txt",
  "/data/borjai-import-03.txt",
  "/data/borjai-import-04.txt",
  "/data/borjai-import-05.txt",
  "/data/borjai-import-06.txt"
];

async function decodePayload() {
  const parts = await Promise.all(CHUNKS.map(async (path) => {
    const response = await fetch(`${path}?v=2.0.7`, { cache: "no-store" });
    if (!response.ok) throw new Error(`No se pudo cargar ${path}.`);
    return response.text();
  }));
  const binary = atob(parts.join(""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  if (!window.DecompressionStream) throw new Error("Este navegador no soporta la importación comprimida de Borjai.");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(stream).text());
}

export async function importPdfDataIfNeeded(api, currentState) {
  if ((currentState?.transactions || []).length) return currentState;
  if ((currentState?.imports || []).some((item) => String(item.id || "").startsWith("bbva-pdf-2026-09"))) return currentState;
  const imported = await decodePayload();
  const next = {
    ...currentState,
    accounts: imported.accounts,
    assets: imported.assets,
    debts: imported.debts,
    transactions: imported.transactions,
    goals: imported.goals,
    imports: imported.imports,
    snapshots: imported.snapshots,
    profile: { ...(currentState.profile || {}), ...(imported.profile || {}) }
  };
  return api.saveState(next);
}
