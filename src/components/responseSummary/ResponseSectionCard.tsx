"use client";

import { useState } from "react";
import {
  Target,
  Compass,
  AlertTriangle,
  Eye,
  Handshake,
  CalendarClock,
  Sparkles,
  Users,
  UserCircle2,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import type { ResponseViewModel } from "./types";
import { ResponseCard } from "./ResponseCard";

/** Íconos por nombre de sección — cosmético, no interpreta el contenido de
 * las respuestas (ver Contexto del plan: nada de clasificación semántica).
 * Nombres calcados de MEETING_SECTIONS (meetingOsTemplate.ts) + los rótulos
 * fijos que arma responseExtraction.ts/normalizeMiniAppLeadResponses.ts. */
const SECTION_ICON: Record<string, LucideIcon> = {
  Encuadre: Compass,
  Objetivos: Target,
  "Situación actual": Eye,
  Consecuencias: AlertTriangle,
  Visión: Eye,
  Compromiso: Handshake,
  "Próximo paso": CalendarClock,
  Valoración: Sparkles,
  Referidos: Users,
  "Datos del cliente": UserCircle2,
  Resultado: Sparkles,
  "Respuestas del diagnóstico": Target,
  Datos: UserCircle2,
};

const INITIAL_VISIBLE = 3;

export function ResponseSectionCard({ section, models }: { section: string; models: ResponseViewModel[] }) {
  const [showAll, setShowAll] = useState(false);
  const Icon = SECTION_ICON[section] ?? Sparkles;
  const visible = showAll ? models : models.slice(0, INITIAL_VISIBLE);
  const hasMore = models.length > INITIAL_VISIBLE;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-500/20 text-accent-200">
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <h3 className="text-[15px] font-semibold text-white">{section}</h3>
        <span className="text-xs text-white/50">({models.length})</span>
      </div>

      <div className="flex flex-col gap-2.5">
        {visible.map((m) => (
          <ResponseCard key={m.key} model={m} />
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll(!showAll)}
          className="mt-1 inline-flex w-fit items-center gap-1 text-xs font-medium text-accent-300 hover:text-accent-200"
        >
          {showAll ? "Ver menos" : `Ver todas las respuestas (${models.length})`}
          <ChevronDown className={`size-3.5 transition-transform duration-[180ms] ${showAll ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
