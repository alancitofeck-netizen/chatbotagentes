"use client";

import { createPortal } from "react-dom";
import { prefersReducedMotion } from "./waitForElement";

const PADDING = 8;

/** Overlay con "agujero" real (no clip-path: 4 franjas alrededor del target,
 * cada una bloqueando clicks) — el hueco en sí nunca tiene ningún elemento
 * encima, así el click real del usuario llega directo al elemento real de
 * la página (necesario para los pasos action:'click', §5 del pedido:
 * "El sistema espera que el usuario haga clic"). Una quinta franja (el
 * anillo, pointer-events:none) da el borde/glow visual sobre el hueco. */
export function TourSpotlight({ rect, onBackdropClick }: { rect: DOMRect; onBackdropClick?: () => void }) {
  const reduced = prefersReducedMotion();
  const top = Math.max(rect.top - PADDING, 0);
  const left = Math.max(rect.left - PADDING, 0);
  const width = rect.width + PADDING * 2;
  const height = rect.height + PADDING * 2;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const transition = reduced ? undefined : "top 220ms var(--ease-out), left 220ms var(--ease-out), width 220ms var(--ease-out), height 220ms var(--ease-out)";
  const bg = "rgba(9, 9, 11, 0.55)";
  const bars = [
    { top: 0, left: 0, width: vw, height: top },
    { top: top + height, left: 0, width: vw, height: Math.max(vh - (top + height), 0) },
    { top, left: 0, width: left, height },
    { top, left: left + width, width: Math.max(vw - (left + width), 0), height },
  ];

  return createPortal(
    <div aria-hidden="true">
      {bars.map((bar, i) => (
        <div
          key={i}
          onClick={onBackdropClick}
          style={{ position: "fixed", top: bar.top, left: bar.left, width: bar.width, height: bar.height, background: bg, zIndex: "var(--z-tour-spotlight)" as unknown as number, transition }}
        />
      ))}
      <div
        style={{
          position: "fixed",
          top,
          left,
          width,
          height,
          zIndex: "var(--z-tour-spotlight)" as unknown as number,
          borderRadius: 12,
          boxShadow: "0 0 0 3px var(--color-accent-500), 0 0 24px 4px rgba(108, 99, 255, 0.35)",
          pointerEvents: "none",
          transition,
        }}
      />
    </div>,
    document.body,
  );
}
