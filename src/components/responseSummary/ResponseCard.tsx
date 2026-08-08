"use client";

import { useState } from "react";
import { ChevronDown, Star } from "lucide-react";
import type { ResponseViewModel } from "./types";

const LONG_TEXT_THRESHOLD = 140;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Una respuesta, en la tarjeta que le corresponde según cómo se capturó el
 * dato (ResponseAnswerType). Si el valor es texto y supera
 * LONG_TEXT_THRESHOLD, colapsa con "Ver respuesta completa" — truncado
 * mecánico (por longitud), no un resumen generado, para no inventar
 * contenido que la respuesta no tiene. */
export function ResponseCard({ model }: { model: ResponseViewModel }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <p className="text-[13px] text-white/60">{model.question}</p>
      <div className="mt-2">{renderAnswer(model, expanded, setExpanded)}</div>
    </div>
  );
}

function renderAnswer(model: ResponseViewModel, expanded: boolean, setExpanded: (v: boolean) => void) {
  const { answer, answerType } = model;

  switch (answerType) {
    case "text":
    case "money":
    case "field": {
      const text = String(answer);
      const isLong = text.length > LONG_TEXT_THRESHOLD;
      return (
        <div>
          <p className={`text-sm leading-relaxed text-white transition-all duration-[180ms] ease-out ${!expanded && isLong ? "line-clamp-2" : ""}`}>{text}</p>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-accent-300 hover:text-accent-200"
            >
              {expanded ? "Ver menos" : "Ver respuesta completa"}
              <ChevronDown className={`size-3.5 transition-transform duration-[180ms] ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
          )}
        </div>
      );
    }
    case "choice":
      return <p className="text-base font-semibold text-white">{String(answer)}</p>;
    case "multi_choice":
    case "ranking": {
      const items = Array.isArray(answer) ? answer : [];
      return (
        <ol className="flex flex-col gap-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-center gap-2 text-sm text-white">
              {answerType === "ranking" && <span className="text-xs font-semibold text-accent-300">{i + 1}.</span>}
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
          {typeof fb.text === "string" && fb.text && <p className="text-sm leading-relaxed text-white">{fb.text}</p>}
          {rating !== null && (
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className={`size-4 ${i < rating ? "fill-warning-strong text-warning-strong" : "text-white/20"}`} aria-hidden="true" />
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
        <ul className="flex flex-col gap-1 text-sm text-white">
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
        <ul className="flex flex-col gap-1 text-sm text-white">
          {parts.map((p, i) => (
            <li key={i}>{String(p)}</li>
          ))}
        </ul>
      );
    }
    case "referral": {
      const list = Array.isArray(answer) ? (answer as { name?: string; phone?: string }[]) : [];
      return (
        <ul className="flex flex-col gap-1 text-sm text-white">
          {list.map((r, i) => (
            <li key={i}>
              {r.name} — {r.phone}
            </li>
          ))}
        </ul>
      );
    }
    default:
      return <p className="text-sm text-white">{typeof answer === "string" ? answer : JSON.stringify(answer)}</p>;
  }
}
