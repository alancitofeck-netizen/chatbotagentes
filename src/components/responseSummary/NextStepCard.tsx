import { ArrowRight, CalendarClock } from "lucide-react";
import type { ResponseViewModel } from "./types";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Muestra el próximo paso REAL ya acordado (fila answerType="next_step"),
 * nunca una sugerencia generada — "preparar una propuesta personalizada"
 * sería inventar contenido que no está en los datos (ver Contexto del plan).
 * Sin próximo paso registrado, un estado vacío honesto en vez de rellenar
 * con una sugerencia genérica. */
export function NextStepCard({ nextStep }: { nextStep: ResponseViewModel | undefined }) {
  const ns = nextStep ? asRecord(nextStep.answer) : null;
  const date = ns && typeof ns.date === "string" ? ns.date : null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border-default bg-surface-2 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-500/15 text-accent-600">
          <CalendarClock className="size-4" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-foreground">Próximo paso</p>
          {date ? (
            <p className="mt-0.5 text-sm text-neutral-600">
              {[date, ns?.time].filter(Boolean).join(" · ")}
              {typeof ns?.objective === "string" && ns.objective ? ` — ${ns.objective}` : ""}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-neutral-500">Todavía no se registró un próximo paso para esta conversación.</p>
          )}
        </div>
      </div>
      {date && (
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-full bg-accent-500 px-4 py-2 text-sm font-medium text-white hover:bg-accent-600 sm:self-center"
          disabled
          title="Próximamente"
        >
          Ir a próxima acción
          <ArrowRight className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
