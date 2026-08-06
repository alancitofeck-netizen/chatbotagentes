/** Client-safe — separado de pdfExtraction.ts (server-only, arrastra
 * pdf-parse/fs) porque PolicyExtractionShell.tsx necesita llamar a esta
 * función desde el cliente. Mismo motivo que policies/constants.ts. */

export type ExtractionConfidence = "alta" | "media" | "baja";

/** Nivel general — calculado acá con una regla fija, NO devuelto por el
 * modelo (mismo criterio "sin puntajes fabricados por la IA" usado en todo
 * el resto de la app): 0 campos dudosos = alta, 1-2 = media, 3+ = baja. */
export function computeExtractionConfidence(lowConfidenceFields: string[]): ExtractionConfidence {
  if (lowConfidenceFields.length === 0) return "alta";
  if (lowConfidenceFields.length <= 2) return "media";
  return "baja";
}
