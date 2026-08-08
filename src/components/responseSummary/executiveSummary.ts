import type { ResponseViewModel } from "./types";

export interface ExecutiveSummaryChip {
  icon: "next_step" | "referral" | "feedback" | "count" | "score";
  label: string;
  value: string;
}

export interface ExecutiveSummary {
  sentence: string;
  chips: ExecutiveSummaryChip[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Síntesis 100% mecánica — solo lee campos ya *tipados* (nunca interpreta
 * texto libre), para no inventar nada sobre lo que el cliente respondió. No
 * es la narrativa con IA que reemplazaría esto más adelante; es el fallback
 * honesto mientras esa pieza no existe (ver Contexto del plan de esta
 * sesión). Devuelve null si no hay ni una sola respuesta — nunca fuerza una
 * oración vacía de relleno. */
export function buildExecutiveSummary(models: ResponseViewModel[]): ExecutiveSummary | null {
  if (models.length === 0) return null;

  const sections = new Set(models.map((m) => m.section ?? "General"));
  const chips: ExecutiveSummaryChip[] = [];
  const sentenceParts = [`${models.length} respuesta${models.length === 1 ? "" : "s"} registrada${models.length === 1 ? "" : "s"} en ${sections.size} sección${sections.size === 1 ? "" : "es"}`];

  const nextStep = models.find((m) => m.answerType === "next_step");
  if (nextStep) {
    const ns = asRecord(nextStep.answer);
    const date = typeof ns.date === "string" && ns.date ? ns.date : null;
    if (date) {
      chips.push({ icon: "next_step", label: "Próximo paso", value: date });
      sentenceParts.push(`próximo paso agendado para el ${date}`);
    } else {
      chips.push({ icon: "next_step", label: "Próximo paso", value: "Acordado" });
    }
  }

  const referral = models.find((m) => m.answerType === "referral");
  if (referral && Array.isArray(referral.answer) && referral.answer.length > 0) {
    chips.push({ icon: "referral", label: "Referidos", value: String(referral.answer.length) });
  }

  const feedback = models.find((m) => m.answerType === "feedback");
  if (feedback) {
    const fb = asRecord(feedback.answer);
    if (typeof fb.rating === "number" && fb.rating > 0) {
      chips.push({ icon: "feedback", label: "Calificación", value: `${fb.rating}/5` });
    }
  }

  const score = models.find((m) => m.key === "score");
  if (score && typeof score.answer === "string") {
    chips.push({ icon: "score", label: "Puntaje", value: score.answer });
  }

  return { sentence: sentenceParts.join(" · ") + ".", chips };
}
