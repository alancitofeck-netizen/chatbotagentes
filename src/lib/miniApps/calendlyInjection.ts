/**
 * Auto-embeds `window.GL_CALENDLY_URL` into an uploaded "Vincular App"
 * bundle's index.html — mismo mecanismo que sdkInjection.ts (marcador +
 * reemplazo idempotente), pero para el campo "URL de Calendly" que se
 * configura en la pestaña Configuración (solo aplica a hostingMode
 * "upload"). El HTML subido nunca necesita tocarse a mano para leer esto:
 * un script del propio archivo puede usar `window.GL_CALENDLY_URL` si
 * existe, degradando sin romper nada si el campo quedó vacío.
 *
 * Llamado desde updateMiniApp (actions.ts) cada vez que se guarda
 * Configuración para una app_vinculada alojada — re-descarga el bundle,
 * reinyecta con el valor actual y vuelve a subir, igual que
 * resyncUploadedBundleKey hace para la API key.
 */

const MARKER_START = "<!-- growthlink-calendly:start -->";
const MARKER_END = "<!-- growthlink-calendly:end -->";

function buildSnippetBlock(calendlyUrl: string): string {
  return [MARKER_START, `<script>window.GL_CALENDLY_URL = ${JSON.stringify(calendlyUrl)};</script>`, MARKER_END].join("\n");
}

/** `calendlyUrl` vacío/null quita el bloque (si estaba) en vez de inyectar
 * uno vacío — así el HTML alojado nunca termina con un `window.GL_CALENDLY_URL = ""`
 * fantasma. */
export function injectCalendlySnippet(html: string, calendlyUrl: string | null | undefined): string {
  const markerRegex = new RegExp(`\\n?${MARKER_START}[\\s\\S]*?${MARKER_END}`, "i");
  const hasMarker = markerRegex.test(html);
  const trimmed = calendlyUrl?.trim();

  if (!trimmed) {
    return hasMarker ? html.replace(markerRegex, "") : html;
  }

  const block = buildSnippetBlock(trimmed);
  if (hasMarker) return html.replace(markerRegex, "\n" + block);

  const lastMatch = [...html.matchAll(/<\/body\s*>/gi)].pop();
  if (lastMatch && lastMatch.index !== undefined) {
    return html.slice(0, lastMatch.index) + block + "\n" + html.slice(lastMatch.index);
  }
  return `${html}\n${block}\n`;
}
