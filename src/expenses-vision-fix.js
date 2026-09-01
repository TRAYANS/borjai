/* BorjaAI · Gastos · repair malformed visual-layer nesting from v1.8.6 */
(function () {
  const STYLE_ID = "borjai-expenses-vision-fix-css";

  function installStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .expenses-redesign .expense-chart-content {
        display: grid !important;
        grid-template-columns: minmax(300px, 43%) minmax(0, 57%) !important;
        align-items: center !important;
        min-height: 430px !important;
        gap: 0 !important;
      }
      .expenses-redesign .expense-donut-wrap {
        position: relative !important;
        width: 300px !important;
        height: 300px !important;
        margin: 0 auto !important;
        display: grid !important;
        place-items: center !important;
      }
      .expenses-redesign .expense-donut {
        position: relative !important;
        width: 300px !important;
        height: 300px !important;
        display: grid !important;
        place-items: center !important;
      }
      .expenses-redesign .expense-donut-svg {
        width: 300px !important;
        height: 300px !important;
      }
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
        max-height: 420px !important;
        overflow-y: auto !important;
        padding: 4px 18px 8px 4px !important;
        scrollbar-width: thin !important;
      }
      @media (max-width: 1050px) {
        .expenses-redesign .expense-chart-content {
          grid-template-columns: 1fr !important;
          min-height: 410px !important;
        }
        .expenses-redesign .expense-category-list {
          grid-column: 1 !important;
          grid-row: 2 !important;
          width: 100% !important;
          max-height: none !important;
          overflow: visible !important;
          padding: 0 18px 18px !important;
        }
      }
      @media (max-width: 720px) {
        .expenses-redesign .expense-chart-content {
          grid-template-columns: 1fr !important;
        }
        .expenses-redesign .expense-donut-wrap,
        .expenses-redesign .expense-donut,
        .expenses-redesign .expense-donut-svg {
          width: 235px !important;
          height: 235px !important;
        }
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

    // The visual renderer historically omitted the closing tag for
    // .expense-donut-wrap, so the category list became its child.
    // Force the intended structure: donut-wrap and category-list are
    // siblings inside the chart grid.
    if (list.parentElement !== content) content.appendChild(list);
    if (donut.parentElement !== donutWrap) donutWrap.appendChild(donut);
  }

  function repairAll() {
    installStyles();
    document.querySelectorAll(".expenses-redesign").forEach(repair);
  }

  const observer = new MutationObserver(() => repairAll());
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("borjai:state", () => setTimeout(repairAll, 0));
  document.addEventListener("DOMContentLoaded", repairAll);
  setTimeout(repairAll, 0);
  setTimeout(repairAll, 250);
  setTimeout(repairAll, 1000);
})();
