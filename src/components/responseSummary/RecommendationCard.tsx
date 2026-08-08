"use client";

import { useState } from "react";
import { Star, ChevronDown } from "lucide-react";

/** Vista previa de la primera recomendación real + "Ver más" que revela el
 * resto tal cual vienen (nunca resumidas/reescritas) — mismas
 * recomendaciones que ya calculó ingest.ts de forma autoritativa. */
export function RecommendationCard({ recommendations }: { recommendations: string[] }) {
  const [expanded, setExpanded] = useState(false);
  if (recommendations.length === 0) return null;
  const [first, ...rest] = recommendations;

  return (
    <div className="col-span-2 rounded-xl border border-border-default bg-surface-2 p-4">
      <p className="flex items-center gap-1.5 text-[13px] text-neutral-500">
        <Star className="size-3.5 text-accent-600" aria-hidden="true" />
        Recomendaciones
      </p>
      <p className={`mt-2 text-sm leading-relaxed text-foreground ${!expanded ? "line-clamp-3" : ""}`}>{first}</p>
      {expanded &&
        rest.map((r, i) => (
          <p key={i} className="mt-2 text-sm leading-relaxed text-foreground">
            {r}
          </p>
        ))}
      {(first.length > 120 || rest.length > 0) && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent-600 hover:text-accent-700"
        >
          {expanded ? "Ver menos" : "Ver más"}
          <ChevronDown className={`size-3.5 transition-transform duration-[180ms] ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
