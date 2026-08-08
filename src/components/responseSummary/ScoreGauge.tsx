const SIZE = 64;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** Franjas de color genéricas sobre el número (no una clasificación nueva —
 * el nombre real del nivel/perfil se muestra aparte, tal cual viene de los
 * datos). Mismos cortes 0-39/40-69/70-100 que ya usan por defecto ambos
 * motores de diagnóstico (diagnosticoEngine.ts / diagnosticoRetiroEngine.ts)
 * — ver Contexto del plan de esta sesión para por qué no se reusa el color
 * configurado (no se guarda en el lead, y los perfiles de retiro ni
 * siquiera tienen uno). */
function tierColor(score: number): string {
  if (score >= 70) return "var(--color-success-strong, #2E9563)";
  if (score >= 40) return "#8D82FF"; // accent-400
  return "var(--color-warning-strong, #B7791F)";
}

export function ScoreGauge({ score, label }: { score: number; label?: string }) {
  const clamped = Math.max(0, Math.min(100, score));
  const offset = CIRCUMFERENCE - (clamped / 100) * CIRCUMFERENCE;
  const color = tierColor(clamped);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg width={SIZE} height={SIZE} className="-rotate-90">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={STROKE} />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 700ms cubic-bezier(0.16,1,0.3,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">{clamped}</div>
      </div>
      {label && <p className="text-xs text-white/60">{label}</p>}
    </div>
  );
}
