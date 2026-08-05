"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils/cn";

/** Slider comparativo Original/IA — arrastra un divisor que revela más o
 * menos de la imagen de la derecha. Queda armado y listo para la Fase 2 de
 * IA de fotos; hasta entonces se usa en modo "vacío" (ver FotosStep.tsx),
 * mostrando el mensaje de "Próximamente" en vez de comparar dos imágenes
 * reales — nunca finge una mejora que no existe todavía. */
export function CompareSlider({ leftSrc, rightSrc, leftLabel = "Original", rightLabel = "IA" }: { leftSrc: string; rightSrc: string; leftLabel?: string; rightLabel?: string }) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function updateFromClientX(clientX: number) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    setPosition(pct);
  }

  return (
    <div
      ref={containerRef}
      className="relative aspect-[4/5] w-full max-w-xs select-none overflow-hidden rounded-lg border border-border-default bg-neutral-900"
      onMouseMove={(e) => dragging.current && updateFromClientX(e.clientX)}
      onMouseUp={() => (dragging.current = false)}
      onMouseLeave={() => (dragging.current = false)}
      onTouchMove={(e) => updateFromClientX(e.touches[0].clientX)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={rightSrc} alt={rightLabel} className="absolute inset-0 size-full object-cover" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={leftSrc}
        alt={leftLabel}
        className="absolute inset-0 size-full object-cover"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      />

      <div
        className="absolute inset-y-0 w-1 -translate-x-1/2 cursor-ew-resize bg-white shadow-[var(--elevation-md)]"
        style={{ left: `${position}%` }}
        onMouseDown={() => (dragging.current = true)}
        onTouchStart={() => (dragging.current = true)}
      >
        <div className="absolute top-1/2 left-1/2 flex size-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[10px] font-semibold text-neutral-700 shadow-[var(--elevation-md)]">
          ⇔
        </div>
      </div>

      <span className={cn("absolute left-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white")}>{leftLabel}</span>
      <span className={cn("absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white")}>{rightLabel}</span>
    </div>
  );
}
