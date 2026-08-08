import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ResponseViewModel } from "./types";
import { buildExecutiveSummary } from "./executiveSummary";
import { ExecutiveSummaryCard } from "./ExecutiveSummaryCard";
import { ResponseSectionCard } from "./ResponseSectionCard";
import { NextStepCard } from "./NextStepCard";
import { AnswerTimeline } from "./AnswerTimeline";
import { StatusBadge } from "./StatusBadge";

export interface ResponseSummaryMeta {
  label: string;
  value: string;
}

/** Composición reusable de la pantalla de "informe" — no sabe nada de
 * Asesorías ni de Mini Apps, recibe todo ya normalizado (ver
 * normalizeAsesoriaResponses.ts / normalizeMiniAppLeadResponses.ts). Usa los
 * mismos tokens semánticos (`surface-*`, `foreground`, `border-*`) que el
 * resto del CRM en vez de colores oscuros fijos, para que respete el toggle
 * de tema claro/oscuro igual que cualquier otra pantalla — no es una
 * superficie con identidad visual propia. */
export function ResponseSummaryScreen({
  backHref,
  backLabel,
  title,
  subtitle,
  statusLabel,
  meta,
  models,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle?: string;
  statusLabel?: string;
  meta: ResponseSummaryMeta[];
  models: ResponseViewModel[];
}) {
  const summary = buildExecutiveSummary(models);
  const nextStep = models.find((m) => m.answerType === "next_step");

  const sections: { name: string; rows: ResponseViewModel[] }[] = [];
  for (const model of models) {
    const name = model.section ?? "General";
    let group = sections.find((s) => s.name === name);
    if (!group) {
      group = { name, rows: [] };
      sections.push(group);
    }
    group.rows.push(model);
  }
  for (const group of sections) group.rows.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div className="min-h-full bg-surface-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <Link href={backHref} className="flex w-fit items-center gap-1.5 text-sm text-neutral-500 hover:text-foreground">
            <ArrowLeft size={14} aria-hidden="true" />
            {backLabel}
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-foreground">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
            </div>
            {statusLabel && <StatusBadge variant="success">{statusLabel}</StatusBadge>}
          </div>
        </div>

        {meta.length > 0 && (
          <div className="grid grid-cols-2 gap-4 rounded-2xl border border-border-default bg-surface-2 p-5 sm:grid-cols-4">
            {meta.map((m) => (
              <div key={m.label}>
                <p className="text-xs font-medium tracking-wide text-neutral-400 uppercase">{m.label}</p>
                <p className="mt-1 text-sm text-foreground">{m.value}</p>
              </div>
            ))}
          </div>
        )}

        {summary && <ExecutiveSummaryCard summary={summary} />}

        {models.length === 0 ? (
          <div className="rounded-2xl border border-border-default bg-surface-2 p-8 text-center">
            <p className="text-sm text-neutral-500">Todavía no hay respuestas registradas.</p>
          </div>
        ) : (
          <>
            {models.length > 1 && (
              <div className="rounded-2xl border border-border-default bg-surface-2 p-5">
                <AnswerTimeline models={models} />
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {sections.map((s) => (
                <ResponseSectionCard key={s.name} section={s.name} models={s.rows} />
              ))}
            </div>

            <NextStepCard nextStep={nextStep} />
          </>
        )}
      </div>
    </div>
  );
}
