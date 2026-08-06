"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";

const COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#ec4899", "#8b5cf6"];

interface Particle {
  id: number;
  angle: number;
  distance: number;
  size: number;
  color: string;
  rotate: number;
}

function generateParticles(): Particle[] {
  return Array.from({ length: 28 }, (_, i) => ({
    id: i,
    angle: Math.random() * Math.PI * 2,
    distance: 80 + Math.random() * 140,
    size: 6 + Math.random() * 6,
    color: COLORS[i % COLORS.length],
    rotate: Math.random() * 360,
  }));
}

/** Efecto de celebración al completar una meta o desbloquear un logro —
 * partículas cuadradas explotando desde el centro con framer-motion, sin
 * dependencia externa de confetti. Se auto-cierra sola tras la animación
 * (onComplete), pensada para dispararse una vez por evento nuevo, nunca en
 * loop. */
export function CelebrationBurst({ active, onComplete }: { active: boolean; onComplete?: () => void }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) return;
    Promise.resolve().then(() => setParticles(generateParticles()));
    const timer = setTimeout(() => onComplete?.(), 1200);
    return () => clearTimeout(timer);
  }, [active, onComplete]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center" aria-hidden="true">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-sm"
          style={{ width: p.size, height: p.size, backgroundColor: p.color }}
          initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
          animate={{ x: Math.cos(p.angle) * p.distance, y: Math.sin(p.angle) * p.distance - 40, opacity: 0, rotate: p.rotate }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}
