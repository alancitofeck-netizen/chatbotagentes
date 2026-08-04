export const SIDEBAR_PINNED_STORAGE_KEY = "gl-sidebar-pinned";

/**
 * Runs before hydration (inlined as a blocking <script> in the root
 * layout, same pattern as src/lib/theme/script.ts's themeInitScript) so a
 * pinned sidebar starts at its real 280px width on the very first paint —
 * without this, the reserved placeholder would flash at 72px and then
 * widen once React hydrates and reads localStorage, a visible layout jump
 * this script exists specifically to avoid.
 */
export const sidebarPinInitScript = `
(function () {
  try {
    if (localStorage.getItem("${SIDEBAR_PINNED_STORAGE_KEY}") === "true") {
      document.documentElement.setAttribute("data-sidebar-pinned", "true");
    }
  } catch (e) {}
})();
`;
