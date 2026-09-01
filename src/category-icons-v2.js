const CATEGORY_ICONS = {
  Vivienda: "🏠",
  Alimentacion: "🛒",
  Restaurantes: "🍽️",
  Gasolina: "⛽",
  Transporte: "🚆",
  Ocio: "🎮",
  Compras: "🛍️",
  Suscripciones: "🔁",
  Viajes: "✈️",
  Salud: "❤️",
  Seguros: "🛡️",
  Formacion: "🎓",
  Tecnologia: "💻",
  Inversiones: "📈",
  Criptomonedas: "₿",
  Impuestos: "🧾",
  Otros: "•"
};

function clean(value) {
  return String(value || "").trim();
}

function decorate(root) {
  if (!root) return;

  root.querySelectorAll(".bar-row-label").forEach((label) => {
    if (label.querySelector(".category-icon")) return;
    const name = clean(label.textContent);
    const icon = CATEGORY_ICONS[name];
    if (!icon) return;
    label.innerHTML = `<span class="category-icon" aria-hidden="true">${icon}</span><span class="category-icon-name"></span>`;
    label.querySelector(".category-icon-name").textContent = name;
  });

  root.querySelectorAll("td").forEach((cell) => {
    if (cell.querySelector(".category-icon")) return;
    const text = clean(cell.textContent);
    const icon = CATEGORY_ICONS[text];
    if (!icon) return;
    cell.innerHTML = `<span class="category-cell"><span class="category-icon" aria-hidden="true">${icon}</span><span></span></span>`;
    cell.querySelector(".category-cell > span:last-child").textContent = text;
  });

  root.querySelectorAll(".summary-stat").forEach((card) => {
    const value = card.querySelector("strong");
    if (!value) return;
    const label = clean(card.querySelector("span")?.textContent);
    if (label !== "Categoria principal" || card.querySelector(".category-icon")) return;
    const name = clean(value.textContent);
    const icon = CATEGORY_ICONS[name];
    if (!icon) return;
    value.innerHTML = `<span class="category-summary"><span class="category-icon" aria-hidden="true">${icon}</span><span></span></span>`;
    value.querySelector(".category-summary > span:last-child").textContent = name;
  });
}

const style = document.createElement("style");
style.textContent = `
  .bar-row-label { display:flex; align-items:center; gap:9px; min-width:145px; }
  .category-icon { display:inline-flex; width:28px; height:28px; flex:0 0 28px; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,.08); border-radius:8px; background:#181b21; font-size:15px; line-height:1; }
  .category-icon-name { min-width:0; }
  .category-cell { display:inline-flex; align-items:center; gap:8px; }
  .category-summary { display:inline-flex; align-items:center; gap:8px; }
  .category-summary .category-icon { width:25px; height:25px; flex-basis:25px; font-size:14px; }
`;
document.head.appendChild(style);

const observer = new MutationObserver(() => decorate(document.getElementById("app-view")));
observer.observe(document.documentElement, { childList: true, subtree: true });
document.addEventListener("DOMContentLoaded", () => decorate(document.getElementById("app-view")));
decorate(document.getElementById("app-view"));
