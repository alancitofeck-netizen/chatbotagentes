/** Modelo compartido para renderizar "respuestas" — de una Asesoría
 * (Meeting OS, ver asesoria_responses/responseExtraction.ts) o de un lead de
 * Mini App (mini_app_leads.data, ver normalizeMiniAppLeadResponses.ts) — con
 * el mismo sistema visual (ver ResponseSummaryScreen.tsx). Ninguno de los dos
 * normalizadores toca los datos de origen; solo los proyectan a esta forma.
 *
 * `ResponseAnswerType` es deliberadamente MECÁNICO (cómo se capturó el dato),
 * no semántico (qué significa la pregunta) — clasificar una pregunta como
 * "objetivo" vs. "motivación" a partir de su texto libre requeriría NLU real
 * sobre preguntas que el asesor puede editar libremente, así que no se intenta
 * (ver el Contexto del plan de esta sesión). */

export type ResponseAnswerType =
  | "text"
  | "money"
  | "choice"
  | "multi_choice"
  | "ranking"
  | "feedback"
  | "decision_makers"
  | "next_step"
  | "referral"
  | "field";

export interface ResponseViewModel {
  key: string;
  question: string;
  answer: unknown;
  answerType: ResponseAnswerType;
  section: string | null;
  /** Orden relativo dentro de la fuente (slide_number, índice de pregunta,
   * etc.) — null para filas sin una posición natural. Usado para ordenar
   * dentro de una sección y para AnswerTimeline. */
  order: number | null;
}
