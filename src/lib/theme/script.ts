export const THEME_STORAGE_KEY = "gl-theme";

/**
 * Runs before hydration (inlined as a blocking <script> in the root layout)
 * so the correct theme is on <html data-theme="..."> before first paint —
 * avoids a flash of the wrong theme. Falls back to system preference when
 * nothing is stored yet.
 */
export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem("${THEME_STORAGE_KEY}");
    var theme = stored === "light" || stored === "dark" ? stored : null;
    if (theme) {
      document.documentElement.setAttribute("data-theme", theme);
    }
  } catch (e) {}
})();
`;
