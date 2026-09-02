/* BorjaAI · Gastos · definitive visual layout repair */
(function () {
  const STYLE_ID = "borjai-expenses-vision-fix-css";

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .expenses-redesign .expense-category-panel { overflow: hidden !important; }
      .expenses-redesign .expense-category-panel .panel-head { margin-bottom: 0 !important; }
      .expenses-redesign .expense-chart-content {
        display: grid !important;
        grid-template-columns: 300px minmax(360px, 430px) !important;
        align-items: center !important;
        justify-content: center !important;
        width: 100% !important;
        height: 270px !important;
        min-height: 270px !important;
        max-height: 270px !important;
        gap: 24px !important;
        margin: 0 auto !important;
        padding: 0 !important;
      }
      .expenses-redesign .expense-donut-wrap {
        position: relative !important;
        width: 250px !important;
        height: 250px !important;
        margin: 0 auto !important;
        display: grid !important;
        place-items: center !important;
        align-self: center !important;
      }
      .expenses-redesign .expense-donut {
        position: relative !important;
        width: 250px !important;
        height: 250px !important;
        display: grid !important;
        place-items: center !important;
      }
      .expenses-redesign .expense-donut-svg { width: 250px !important; height: 250px !important; }
      .expenses-redesign .expense-donut-center {
        position: absolute !important;
        inset: 0 !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex-direction: column !important;
        pointer-events: none !important;
      }
      .expenses-redesign .expense-category-list {
        grid-column: 2 !important;
        grid-row: 1 !important;
        min-width: 0 !important;
        max-height: 250px !important;
        overflow: visible !important;
        padding: 0 !important;
        align-self: center !important;
      }
      .expenses-redesign .expense-category-row {
        min-height: 27px !important;
        height: 27px !important;
        padding: 0 4px !important;
      }
      .expenses-redesign .expense-all-categories { margin-top: 8px !important; }
      @media (max-width: 1050px) {
        .expenses-redesign .expense-chart-content {
          grid-template-columns: 1fr !important;
          height: auto !important;
          min-height: 0 !important;
          max-height: none !important;
          gap: 14px !important;
          padding: 8px 0 12px !important;
        }
        .expenses-redesign .expense-category-list {
          grid-column: 1 !important;
          grid-row: 2 !important;
          width: min(100%, 520px) !important;
          margin: 0 auto !important;
        }
      }
      @media (max-width: 720px) {
        .expenses-redesign .expense-donut-wrap,
        .expenses-redesign .expense-donut,
        .expenses-redesign .expense-donut-svg { width: 220px !important; height: 220px !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function repair(root) {
    if (!root || !root.matches(".expenses-redesign")) return;
    const content = root.querySelector(".expense-chart-content");
    const donutWrap = root.querySelector(".expense-donut-wrap");
    const donut = root.querySelector(".expense-donut");
    const list = root.querySelector(".expense-category-list");
    if (!content || !donutWrap || !donut || !list) return;
    if (list.parentElement !== content) content.appendChild(list);
    if (donut.parentElement !== donutWrap) donutWrap.appendChild(donut);
  }

  function repairAll() {
    installStyles();
    document.querySelectorAll(".expenses-redesign").forEach(repair);
  }

  const observer = new MutationObserver(repairAll);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener("DOMContentLoaded", repairAll);
  window.addEventListener("borjai:state", () => setTimeout(repairAll, 0));
  setTimeout(repairAll, 0);
  setTimeout(repairAll, 250);
  setTimeout(repairAll, 1000);
})();
