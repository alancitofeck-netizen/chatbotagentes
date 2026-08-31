/** Cálculo del interaction_score/interaction_level de un lead de ManyChat —
 * aislado en su propio archivo a propósito (pedido explícito del usuario)
 * para poder ajustar la lógica sin tocar el resto de la integración.
 * Puramente determinístico sobre señales reales ya contadas — nunca inventa
 * ni asume datos que ManyChat no mandó. */

export interface InteractionScoreInput {
  leadMessageCount: number;
  manychatMessageCount: number;
  /** Minutos entre first_interaction_at y last_interaction_at. */
  durationMinutes: number;
  /** Cantidad de claves reales en captured_data (custom fields que
   * ManyChat efectivamente mandó, nunca un valor fabricado). */
  capturedFieldsCount: number;
  hasPhone: boolean;
  hasEmail: boolean;
}

export type InteractionLevel = "none" | "low" | "medium" | "high";

/** Pesos simples, fáciles de retocar — cada señal aporta hasta un tope fijo,
 * la suma se clampea a 0-100. Nada de esto es "score final basado en
 * texto/sentimiento" (eso sería inventar algo que no está en los datos
 * reales disponibles hoy) — solo cuenta señales objetivas ya persistidas. */
export function calculateInteractionScore(input: InteractionScoreInput): number {
  const messagesScore = Math.min(input.leadMessageCount * 4, 40); // hasta 10 mensajes reales del lead
  const durationScore = Math.min(input.durationMinutes / 2, 20); // hasta 40 min de conversación
  const dataScore = Math.min(input.capturedFieldsCount * 8, 24); // hasta 3 datos capturados
  const contactScore = (input.hasPhone ? 8 : 0) + (input.hasEmail ? 8 : 0);

  const total = messagesScore + durationScore + dataScore + contactScore;
  return Math.max(0, Math.min(100, Math.round(total)));
}

const LEVEL_THRESHOLDS: { max: number; level: InteractionLevel }[] = [
  { max: 0, level: "none" },
  { max: 30, level: "low" },
  { max: 65, level: "medium" },
  { max: 100, level: "high" },
];

export function deriveInteractionLevel(score: number): InteractionLevel {
  if (score <= 0) return "none";
  for (const { max, level } of LEVEL_THRESHOLDS) {
    if (score <= max) return level;
  }
  return "high";
}
