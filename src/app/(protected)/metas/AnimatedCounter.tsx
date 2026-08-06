"use client";

import { useEffect, useRef } from "react";
import { animate } from "framer-motion";

/** Contador animado compartido — el spec pide "contadores animados" en
 * varios lugares (tarjetas de meta, KPIs). Anima el número anterior hacia
 * el nuevo con framer-motion en vez de saltar directo, sin re-render de
 * React por frame (escribe al DOM directo vía ref, como recomienda la
 * propia doc de framer-motion para animar valores numéricos). */
export function AnimatedCounter({ value, formatter, className }: { value: number; formatter?: (v: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const from = prevValue.current;
    const controls = animate(from, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate(v) {
        node.textContent = formatter ? formatter(v) : String(Math.round(v));
      },
    });
    prevValue.current = value;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <span ref={ref} className={className}>
      {formatter ? formatter(value) : value}
    </span>
  );
}
