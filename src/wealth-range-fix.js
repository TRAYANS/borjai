const PERIODS = [
  ["1d", "1D"],
  ["1w", "1S"],
  ["1m", "1M"],
  ["3m", "3M"],
  ["6m", "6M"],
  ["1y", "1A"],
  ["3y", "3A"],
  ["5y", "5A"],
  ["max", "MAX"]
];

const KEY = "borjai:wealth-range";

function syncOriginalSelector() {
  const panel = document.querySelector(".chart-panel");
  if (!panel) return false;
  const select = panel.querySelector(".period-select");
  if (!select) return false;

  if (select.dataset.wealthRangeFixed !== "1") {
    const current = localStorage.getItem(KEY) || "1y";
    select.innerHTML = PERIODS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
    select.value = PERIODS.some(([value]) => value === current) ? current : "1y";
    select.setAttribute("aria-label", "Periodo de evolución del patrimonio");

    select.addEventListener("change", () => {
      const value = select.value;
      localStorage.setItem(KEY, value);
      const tab = panel.querySelector(`[data-wealth-period="${value}"]`);
      if (tab) {
        tab.click();
      } else {
        window.dispatchEvent(new Event("borjai:wealth-range-change"));
      }
    });

    select.dataset.wealthRangeFixed = "1";
  } else {
    const value = localStorage.getItem(KEY) || "1y";
    if (select.value !== value) select.value = value;
  }

  return true;
}

const observer = new MutationObserver(() => syncOriginalSelector());
observer.observe(document.body, { childList: true, subtree: true });
syncOriginalSelector();
