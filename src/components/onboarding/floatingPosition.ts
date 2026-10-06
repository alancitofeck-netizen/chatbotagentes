import { computePosition, autoUpdate, flip, shift, offset, size } from "@floating-ui/dom";

export interface FloatingPosition {
  top: number;
  left: number;
  placement: "top" | "bottom" | "left" | "right";
}

/** Reposiciona `floatingEl` relativo a `referenceEl` en cada scroll/resize/
 * cambio de layout (autoUpdate de floating-ui) — nunca se sale de pantalla
 * (flip cambia de lado si no entra, shift lo corre para no cortarse) ni
 * genera scroll horizontal (§33/§34 del pedido). Devuelve una función de
 * limpieza (llamar en el cleanup del efecto que la usa). */
export function attachFloatingPosition(
  referenceEl: Element,
  floatingEl: HTMLElement,
  placement: "top" | "bottom" | "left" | "right",
  onUpdate: (pos: FloatingPosition) => void,
): () => void {
  return autoUpdate(referenceEl, floatingEl, () => {
    computePosition(referenceEl, floatingEl, {
      placement,
      strategy: "fixed",
      // En mobile un objetivo que ocupa casi todo el ancho no deja lugar a los
      // costados: flip cae a arriba/abajo y size limita el ancho al viewport
      // (el shift sólo corrige el eje cruzado, no alcanza para el eje principal).
      middleware: [
        offset(10),
        flip(window.innerWidth < 768 ? { fallbackPlacements: ["bottom", "top"] } : {}),
        shift({ padding: 8 }),
        size({
          padding: 8,
          apply({ availableWidth, elements }) {
            elements.floating.style.maxWidth = `${availableWidth}px`;
          },
        }),
      ],
    }).then(({ x, y, placement: resolved }) => {
      onUpdate({ top: y, left: x, placement: resolved.split("-")[0] as FloatingPosition["placement"] });
    });
  });
}
