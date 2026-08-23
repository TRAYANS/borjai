const modalId = "ai-import-modal";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[c]));
}

function closeAiImport() {
  document.getElementById(modalId)?.remove();
}

function openAiImport() {
  closeAiImport();
  const root = document.createElement("div");
  root.id = modalId;
  root.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,.68);display:flex;align-items:center;justify-content:center;z-index:9999;padding:20px">
      <section style="width:min(620px,100%);background:#111318;border:1px solid #292c33;border-radius:20px;padding:24px;color:#fff;box-shadow:0 24px 80px rgba(0,0,0,.45)">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:16px">
          <div><h2 style="margin:0">Importar con IA</h2><p style="color:#9da3ad;margin:6px 0 0">Sube una captura de tu banco o broker y BorjaAI convertirá la imagen en datos.</p></div>
          <button id="ai-close" type="button" style="background:none;border:0;color:#9da3ad;font-size:24px;cursor:pointer">×</button>
        </div>
        <label style="display:block;margin-top:22px;border:1px dashed #444957;border-radius:14px;padding:28px;text-align:center;cursor:pointer">
          <input id="ai-file" type="file" accept="image/*" style="display:none">
          <strong id="ai-file-label">Seleccionar captura</strong>
          <div style="color:#9da3ad;margin-top:6px;font-size:13px">JPG, PNG o WEBP</div>
        </label>
        <button id="ai-analyze" type="button" disabled style="width:100%;margin-top:14px;padding:13px;border:0;border-radius:10px;background:#f32d3a;color:#fff;font-weight:700;cursor:pointer">Analizar con IA</button>
        <div id="ai-status" style="margin-top:14px;color:#9da3ad;min-height:22px"></div>
        <pre id="ai-result" style="display:none;margin-top:14px;background:#090a0d;border:1px solid #292c33;border-radius:12px;padding:14px;overflow:auto;max-height:280px;font-size:12px"></pre>
      </section>
    </div>`;
  document.body.appendChild(root);

  const fileInput = root.querySelector("#ai-file");
  const analyze = root.querySelector("#ai-analyze");
  const status = root.querySelector("#ai-status");
  const result = root.querySelector("#ai-result");

  root.querySelector("#ai-close").onclick = closeAiImport;
  fileInput.onchange = () => {
    const file = fileInput.files?.[0];
    root.querySelector("#ai-file-label").textContent = file ? file.name : "Seleccionar captura";
    analyze.disabled = !file;
  };

  analyze.onclick = async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    analyze.disabled = true;
    status.textContent = "Analizando captura…";
    result.style.display = "none";
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType: file.type || "image/jpeg" })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No se pudo analizar la captura.");
      status.textContent = "Datos detectados. Revísalos antes de guardarlos.";
      result.textContent = JSON.stringify(payload.data, null, 2);
      result.style.display = "block";
    } catch (error) {
      status.textContent = error.message || "Error al analizar la imagen.";
    } finally {
      analyze.disabled = false;
    }
  };
}

document.addEventListener("click", event => {
  const trigger = event.target.closest('[data-action="open-ai-import"]');
  if (trigger) openAiImport();
});
