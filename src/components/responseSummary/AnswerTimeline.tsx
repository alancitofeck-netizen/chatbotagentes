import type { ResponseViewModel } from "./types";

function summarizeAnswer(model: ResponseViewModel): string {
  const { answer, answerType } = model;
  if (answerType === "text" || answerType === "money" || answerType === "choice" || answerType === "field") {
    const text = String(answer);
    return text.length > 80 ? `${text.slice(0, 80)}…` : text;
  }
  if (Array.isArray(answer)) return answer.map((v) => (typeof v === "object" && v !== null ? Object.values(v)[0] : v)).slice(0, 3).join(", ");
  return "";
}

/** Serie corta (primeras `max` respuestas en orden) para dar una lectura
 * "de un vistazo" antes de las secciones completas — no reemplaza a
 * ResponseSectionCard, es un resumen visual adicional. */
export function AnswerTimeline({ models, max = 5 }: { models: ResponseViewModel[]; max?: number }) {
  const ordered = models
    .filter((m) => m.order !== null)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .slice(0, max);
  if (ordered.length === 0) return null;

  return (
    <ol className="flex flex-col gap-0">
      {ordered.map((m, i) => (
        <li key={m.key} className="relative flex gap-3 pb-5 last:pb-0">
          {i < ordered.length - 1 && <span className="absolute top-7 left-[15px] h-full w-px bg-white/10" aria-hidden="true" />}
          <span className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-500/20 text-xs font-semibold text-accent-200">
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 pt-1">
            <p className="text-[13px] font-medium text-white/60">{m.section ?? "General"}</p>
            <p className="truncate text-sm text-white">{summarizeAnswer(m) || m.question}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
