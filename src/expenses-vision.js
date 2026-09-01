// Loads the final Gastos visual layer after category-icons-v2 injects its runtime styles.
(function () {
  if (document.getElementById('borjai-expenses-vision-css')) return;
  const link = document.createElement('link');
  link.id = 'borjai-expenses-vision-css';
  link.rel = 'stylesheet';
  link.href = 'src/expenses-vision.css?v=1.8.5';
  document.head.appendChild(link);
})();
