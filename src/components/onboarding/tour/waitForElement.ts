/** Primer elemento que matchea `selector` y además está realmente visible
 * (tamaño no nulo) — nunca el primero en orden de DOM sin más. Varios
 * módulos comparten el mismo data-tour entre dos nodos mutuamente
 * excluyentes por breakpoint (ej. CalendarShell.tsx: el botón "Nuevo
 * evento" del header es `hidden md:inline-flex`, su equivalente en mobile
 * es el Fab, `md:hidden`) o por estado (ej. el panel de contacto del Inbox
 * se renderiza dos veces — versión de escritorio siempre montada y otra
 * dentro de un Sheet mobile). `document.querySelector` a secas devolvería
 * siempre el primero en el DOM sin importar si ese es el oculto en el
 * viewport actual — acá se filtra por `getBoundingClientRect()` real. */
function findVisible(selector: string): HTMLElement | null {
  const candidates = document.querySelectorAll<HTMLElement>(selector);
  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return el;
  }
  return null;
}

/** Sondea el DOM hasta que `selector` exista y esté visible (o se agote el
 * timeout) — así el motor de tours no necesita saber si el próximo paso
 * vive en la misma pantalla, detrás de un click que abre un modal, o en
 * otra ruta después de una navegación real de la app (ver TareasTour, que
 * cruza /tasks → /tasks/groups/[id]). Si el timeout se cumple, el llamador
 * debe saltear el paso en vez de dejar el tour "colgado" (§30 del pedido:
 * nunca molestar). */
export function waitForElement(selector: string, timeoutMs = 6000): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const existing = findVisible(selector);
    if (existing) {
      resolve(existing);
      return;
    }
    const observer = new MutationObserver(() => {
      const found = findVisible(selector);
      if (found) {
        cleanup();
        resolve(found);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    const timer = setTimeout(() => {
      cleanup();
      resolve(null);
    }, timeoutMs);
    function cleanup() {
      observer.disconnect();
      clearTimeout(timer);
    }
  });
}

export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
