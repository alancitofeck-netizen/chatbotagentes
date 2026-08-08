import { Star } from "lucide-react";
import type { ResponseViewModel } from "./types";
import { ExpandableText } from "./ExpandableText";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Una respuesta, en la tarjeta que le corresponde según cómo se capturó el
 * dato (ResponseAnswerType). Texto largo se colapsa vía ExpandableText
 * (truncado mecánico por longitud, nunca un resumen generado). */
export function ResponseCard({ model }: { model: ResponseViewModel }) {
  return (
    <div className="rounded-xl border border-border-default bg-surface-1 p-4">
      <p className="text-[13px] text-neutral-500">{model.question}</p>
      <div className="mt-2">{renderAnswer(model)}</div>
    </div>
  );
}

function renderAnswer(model: ResponseViewModel) {
  const { answer, answerType } = model;

  switch (answerType) {
    case "text":
    case "money":
    case "field":
      return <ExpandableText text={String(answer)} />;
    case "choice":
      return <p className="text-base font-semibold text-foreground">{String(answer)}</p>;
    case "multi_choice":
    case "ranking": {
      const items = Array.isArray(answer) ? answer : [];
      return (
        <ol className="flex flex-col gap-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-foreground">
              {answerType === "ranking" && <span className="text-xs font-semibold text-accent-600">{i + 1}.</span>}
              {String(item)}
            </li>
          ))}
        </ol>
      );
    }
    case "feedback": {
      const fb = asRecord(answer);
      const rating = typeof fb.rating === "number" ? fb.rating : null;
      return (
        <div className="flex flex-col gap-2">
          {typeof fb.text === "string" && fb.text && <p className="text-sm leading-relaxed text-foreground">{fb.text}</p>}
          {rating !== null && (
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className={`size-4 ${i < rating ? "fill-warning-strong text-warning-strong" : "text-neutral-300"}`} aria-hidden="true" />
              ))}
            </div>
          )}
        </div>
      );
    }
    case "decision_makers": {
      const list = Array.isArray(answer) ? (answer as { type?: string; name?: string }[]) : [];
      const label: Record<string, string> = { solo: "Decide personalmente", pareja: "Suma a su pareja", socio: "Suma a un socio", familiar: "Suma a un familiar" };
      return (
        <ul className="flex flex-col gap-1 text-sm text-foreground">
          {list.map((dm, i) => (
            <li key={i}>{dm.type === "otro" ? dm.name || "Otra persona" : (label[dm.type ?? ""] ?? dm.type)}</li>
          ))}
        </ul>
      );
    }
    case "next_step": {
      const ns = asRecord(answer);
      const parts = [[ns.date, ns.time].filter(Boolean).join(" · "), ns.objective ? `Objetivo: ${ns.objective}` : null, ns.participants ? `Participantes: ${ns.participants}` : null].filter(Boolean);
      return (
        <ul className="flex flex-col gap-1 text-sm text-foreground">
          {parts.map((p, i) => (
            <li key={i}>{String(p)}</li>
          ))}
        </ul>
      );
    }
    case "referral": {
      const list = Array.isArray(answer) ? (answer as { name?: string; phone?: string }[]) : [];
      return (
        <ul className="flex flex-col gap-1 text-sm text-foreground">
          {list.map((r, i) => (
            <li key={i}>
              {r.name} — {r.phone}
            </li>
          ))}
        </ul>
      );
    }
    default:
      return <p className="text-sm text-foreground">{typeof answer === "string" ? answer : JSON.stringify(answer)}</p>;
  }
}
