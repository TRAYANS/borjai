/* Visual reference pass: small DOM-only polish that does not alter financial logic. */
(function () {
  function ensureVisualCss() {
    if (document.getElementById('borjai-visual-refinement-css')) return;
    const link = document.createElement('link');
    link.id = 'borjai-visual-refinement-css';
    link.rel = 'stylesheet';
    link.href = 'src/visual-refinement.css?v=2.0.3';
    document.head.appendChild(link);
  }

  function capitalizeMonthLabels() {
    document.querySelectorAll('.expense-category-panel .panel-note').forEach((el) => {
      const text = String(el.textContent || '').trim();
      if (!text) return;
      el.textContent = text.charAt(0).toUpperCase() + text.slice(1);
    });
  }

  function markView() {
    const root = document.getElementById('app-view');
    if (!root) return;
    root.classList.remove('view-inicio','view-ingresos','view-gastos','view-patrimonio','view-inversiones','view-objetivos','view-coach');
    const heading = root.querySelector('.view h1');
    if (!heading) return;
    const key = String(heading.textContent || '').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g,'');
    const map = {inicio:'view-inicio', ingresos:'view-ingresos', gastos:'view-gastos', patrimonio:'view-patrimonio', inversiones:'view-inversiones', objetivos:'view-objetivos'};
    if (map[key]) root.classList.add(map[key]);
  }

  function refresh() {
    ensureVisualCss();
    capitalizeMonthLabels();
    markView();
  }

  refresh();
  document.addEventListener('DOMContentLoaded', refresh);
  window.addEventListener('borjai:state', refresh);
  setInterval(refresh, 1000);
})();
