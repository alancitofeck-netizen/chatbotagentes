"use client";

/** Anillo de progreso SVG — sin librería nueva, un `<circle>` con
 * `stroke-dasharray`. La transición de relleno usa `duration-slow`
 * (240ms, mismo token que el resto del sistema de diseño) y se omite por
 * completo con `prefers-reduced-motion` vía la clase `motion-reduce:transition-none`
 * de Tailwind — no hace falta JS para detectarlo acá. */
export function CircularProgress({ value, size = 64, strokeWidth = 6 }: { value: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={`${value}% completado`}>
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--color-neutral-200)" strokeWidth={strokeWidth} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--color-accent-500)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="motion-reduce:transition-none transition-[stroke-dashoffset] duration-[var(--duration-slow)] ease-[var(--ease-out)]"
      />
    </svg>
  );
}
