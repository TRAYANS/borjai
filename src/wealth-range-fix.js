const PERIODS = [
  ["1d", "1D", "Último día"],
  ["1w", "1S", "Última semana"],
  ["1m", "1M", "Último mes"],
  ["3m", "3M", "Últimos 3 meses"],
  ["6m", "6M", "Últimos 6 meses"],
  ["1y", "1A", "Últimos 12 meses"],
  ["3y", "3A", "Últimos 3 años"],
  ["5y", "5A", "Últimos 5 años"],
  ["max", "MAX", "Todo el histórico"]
];

const KEY = "borjai:wealth-range";

function currentPeriod() {
  const value = localStorage.getItem(KEY) || "1y";
  return PERIODS.find(([id]) => id === value) || PERIODS[5];
}

function syncPeriodNote(panel, value) {
  const period = PERIODS.find(([id]) => id === value) || PERIODS[5];
  const note = panel.querySelector(".period-select")?.closest(".panel-head")?.querySelector(".panel-note");
  if (note) note.textContent = period[2];
}

function syncOriginalSelector() {
  const panel = document.querySelector(".chart-panel");
  if (!panel) return false;
  const select = panel.querySelector(".period-select");
  if (!select) return false;

  const [, , periodText] = currentPeriod();

  if (select.dataset.wealthRangeFixed !== "1") {
    const current = localStorage.getItem(KEY) || "1y";
    select.innerHTML = PERIODS.map(([value, label]) => `<option value="${value}">${label}</option>`).join("");
    select.value = PERIODS.some(([value]) => value === current) ? current : "1y";
    select.setAttribute("aria-label", "Periodo de evolución del patrimonio");

    select.addEventListener("change", () => {
      const value = select.value;
      localStorage.setItem(KEY, value);
      syncPeriodNote(panel, value);

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

  syncPeriodNote(panel, select.value || "1y");
  return true;
}

const observer = new MutationObserver(() => syncOriginalSelector());
observer.observe(document.body, { childList: true, subtree: true });
syncOriginalSelector();
