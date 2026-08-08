"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const DEFAULT_THRESHOLD = 140;

/** Truncado mecánico (por longitud) + "Ver respuesta completa" — nunca un
 * resumen generado, para no inventar contenido que el texto no tiene.
 * Extraído de ResponseCard.tsx para poder reusarlo también en
 * RecommendationCard.tsx (ver Contexto del plan de esta sesión). */
export function ExpandableText({
  text,
  threshold = DEFAULT_THRESHOLD,
  expandLabel = "Ver respuesta completa",
  collapseLabel = "Ver menos",
  className,
}: {
  text: string;
  threshold?: number;
  expandLabel?: string;
  collapseLabel?: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > threshold;

  return (
    <div>
      <p className={`text-sm leading-relaxed text-white transition-all duration-[180ms] ease-out ${!expanded && isLong ? "line-clamp-2" : ""} ${className ?? ""}`}>{text}</p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-accent-300 hover:text-accent-200"
        >
          {expanded ? collapseLabel : expandLabel}
          <ChevronDown className={`size-3.5 transition-transform duration-[180ms] ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
