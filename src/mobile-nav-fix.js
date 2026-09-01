// Mobile navigation fix: selecting any sidebar destination closes the drawer.
(function () {
  function closeMenu() {
    const shell = document.querySelector(".app-shell");
    if (shell) shell.classList.remove("menu-open");
  }

  // Capture the click before the view handler so the drawer cannot remain open.
  document.addEventListener("click", function (event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target) return;

    if (target.closest(".sidebar [data-view]")) {
      closeMenu();
      return;
    }

    // Tapping the dimmed area also closes the drawer.
    const shell = document.querySelector(".app-shell");
    if (shell && shell.classList.contains("menu-open") && target === shell) {
      closeMenu();
    }
  }, true);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeMenu();
  });
})();
