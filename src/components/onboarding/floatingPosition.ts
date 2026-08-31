import { computePosition, autoUpdate, flip, shift, offset } from "@floating-ui/dom";

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
      middleware: [offset(10), flip(), shift({ padding: 8 })],
    }).then(({ x, y, placement: resolved }) => {
      onUpdate({ top: y, left: x, placement: resolved.split("-")[0] as FloatingPosition["placement"] });
    });
  });
}
