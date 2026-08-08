import { Gauge, User, Target, PieChart, BarChart3, Info, type LucideIcon } from "lucide-react";
import type { ResponseViewModel } from "./types";
import { ScoreGauge } from "./ScoreGauge";
import { RecommendationCard } from "./RecommendationCard";

const KEY_ICON: Record<string, LucideIcon> = {
  score: Gauge,
  level: User,
  perfil: User,
  theme: Target,
  areas: PieChart,
  answers: BarChart3,
};

/** Versión compacta de ResponseCard para grillas angostas (ej. el panel
 * lateral de un lead, ~380-440px) — mismos datos normalizados
 * (ResponseViewModel), presentación distinta según el tipo. `key==="score"`
 * y `key==="recomendaciones"` tienen tratamiento especial (gauge / preview
 * expandible); el resto cae a una tarjeta compacta genérica. */
export function SimulationMetricCard({ model }: { model: ResponseViewModel }) {
  if (model.key === "score" && typeof model.answer === "string") {
    const num = parseInt(model.answer, 10);
    if (!Number.isNaN(num)) {
      return (
        <div className="flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-4">
          <ScoreGauge score={num} />
          <p className="text-xs text-white/60">{model.question}</p>
        </div>
      );
    }
  }

  if (model.key === "recomendaciones" && Array.isArray(model.answer)) {
    return <RecommendationCard recommendations={model.answer.filter((r): r is string => typeof r === "string")} />;
  }

  const Icon = KEY_ICON[model.key] ?? Info;

  if (Array.isArray(model.answer)) {
    return (
      <div className="col-span-2 rounded-xl border border-white/10 bg-white/5 p-4">
        <p className="flex items-center gap-1.5 text-[13px] text-white/60">
          <Icon className="size-3.5 text-accent-300" aria-hidden="true" />
          {model.question}
        </p>
        <p className="mt-1.5 text-sm text-white">{model.answer.map((v) => (typeof v === "object" && v !== null ? Object.values(v).join(" ") : String(v))).join(", ")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="flex items-center gap-1.5 text-[13px] text-white/60">
        <Icon className="size-3.5 text-accent-300" aria-hidden="true" />
        {model.question}
      </p>
      <p className="mt-1.5 truncate text-sm font-medium text-white">{String(model.answer)}</p>
    </div>
  );
}
