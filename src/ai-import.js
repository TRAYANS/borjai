const modalId = "ai-import-modal";

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>\"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" }[c]));
}

function closeAiImport() {
  document.getElementById(modalId)?.remove();
}

function setStatus(root, text, error = false) {
  const node = root.querySelector("#ai-status");
  if (!node) return;
  node.textContent = text;
  node.style.color = error ? "#ff6974" : "#9da3ad";
}

async function imageToJpegBase64(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("El navegador no puede leer esta imagen. En HEIC, prueba a compartirla como JPG o PNG."));
      img.src = objectUrl;
    });

    const maxSide = 2400;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    return { base64: dataUrl.split(",")[1], mimeType: "image/jpeg" };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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
          <input id="ai-file" type="file" accept="image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp,.heic" style="display:none">
          <strong id="ai-file-label">Seleccionar captura</strong>
          <div style="color:#9da3ad;margin-top:6px;font-size:13px">JPG, PNG, WEBP o HEIC · la imagen se convierte a JPG antes de enviarse</div>
        </label>
        <button id="ai-analyze" type="button" disabled style="width:100%;margin-top:14px;padding:13px;border:0;border-radius:10px;background:#f32d3a;color:#fff;font-weight:700;cursor:pointer">Analizar con IA</button>
        <div id="ai-status" style="margin-top:14px;color:#9da3ad;min-height:22px"></div>
        <pre id="ai-result" style="display:none;margin-top:14px;background:#090a0d;border:1px solid #292c33;border-radius:12px;padding:14px;overflow:auto;max-height:280px;font-size:12px"></pre>
        <button id="ai-register" type="button" disabled style="display:none;width:100%;margin-top:12px;padding:13px;border:1px solid #383c45;border-radius:10px;background:#191b21;color:#fff;font-weight:700;cursor:pointer">Revisar y registrar datos</button>
      </section>
    </div>`;
  document.body.appendChild(root);

  const fileInput = root.querySelector("#ai-file");
  const analyze = root.querySelector("#ai-analyze");
  const status = root.querySelector("#ai-status");
  const result = root.querySelector("#ai-result");
  const register = root.querySelector("#ai-register");
  let extracted = null;

  root.querySelector("#ai-close").onclick = closeAiImport;
  fileInput.onchange = () => {
    const file = fileInput.files?.[0];
    root.querySelector("#ai-file-label").textContent = file ? file.name : "Seleccionar captura";
    analyze.disabled = !file;
    register.style.display = "none";
    register.disabled = true;
    extracted = null;
    result.style.display = "none";
    status.textContent = file ? "Archivo listo para analizar." : "";
  };

  analyze.onclick = async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    analyze.disabled = true;
    register.disabled = true;
    register.style.display = "none";
    result.style.display = "none";
    setStatus(root, "Preparando imagen…");

    try {
      const prepared = await imageToJpegBase64(file);
      setStatus(root, "Analizando captura con Groq…");
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: prepared.base64, mimeType: prepared.mimeType })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || `Error del backend (${response.status}).`);
      extracted = payload.data;
      setStatus(root, "Datos detectados. Revísalos antes de guardarlos.");
      result.textContent = JSON.stringify(extracted, null, 2);
      result.style.display = "block";
      register.style.display = "block";
      register.disabled = false;
    } catch (error) {
      setStatus(root, error.message || "Error al analizar la imagen.", true);
    } finally {
      analyze.disabled = false;
    }
  };

  register.onclick = () => {
    if (!extracted) return;
    window.dispatchEvent(new CustomEvent("borjai:ai-import", {
      detail: { data: extracted, fileName: fileInput.files?.[0]?.name || "Importación IA" }
    }));
    closeAiImport();
  };
}

document.addEventListener("click", event => {
  const trigger = event.target.closest('[data-action="open-ai-import"]');
  if (trigger) openAiImport();
});
