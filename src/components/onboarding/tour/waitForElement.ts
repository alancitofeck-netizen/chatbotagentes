/** Sondea el DOM hasta que `selector` exista (o se agote el timeout) — así
 * el motor de tours no necesita saber si el próximo paso vive en la misma
 * pantalla, detrás de un click que abre un modal, o en otra ruta después de
 * una navegación real de la app (ver TareasTour, que cruza /tasks →
 * /tasks/groups/[id]). Si el timeout se cumple, el llamador debe saltear el
 * paso en vez de dejar el tour "colgado" (§30 del pedido: nunca molestar). */
export function waitForElement(selector: string, timeoutMs = 6000): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLElement>(selector);
    if (existing) {
      resolve(existing);
      return;
    }
    const observer = new MutationObserver(() => {
      const found = document.querySelector<HTMLElement>(selector);
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
