import type { AsesoriaResponseRow } from "@/lib/asesorias/queries";
import type { ResponseViewModel, ResponseAnswerType } from "./types";

const TYPE_MAP: Record<string, ResponseAnswerType> = {
  text: "text",
  money: "money",
  choice: "choice",
  multi_choice: "multi_choice",
  ranking: "ranking",
  feedback: "feedback",
  decision_makers: "decision_makers",
  next_step: "next_step",
  referral: "referral",
  prospect_field: "field",
};

/** Adaptador casi directo — asesoria_responses (ver 0117_asesoria_responses.sql
 * y responseExtraction.ts) ya trae question/answer/type/section/slide_number,
 * así que esto solo re-tipa, no reinterpreta nada. */
export function normalizeAsesoriaResponses(rows: AsesoriaResponseRow[]): ResponseViewModel[] {
  return rows.map((r) => ({
    key: r.questionKey,
    question: r.question,
    answer: r.answer,
    answerType: TYPE_MAP[r.answerType] ?? "field",
    section: r.section,
    order: r.slideNumber,
  }));
}
