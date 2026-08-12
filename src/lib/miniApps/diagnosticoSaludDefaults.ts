/** Config por defecto para "Diagnóstico de Salud Financiera" (Financial
 * Score) — los campos del objeto `CONFIG` del HTML original que sirvió de
 * base a este tipo de Mini App. Única fuente de verdad, importada tanto por
 * queries.ts (relleno de defaults si `config` viene vacío/incompleto) como
 * por NewMiniAppWizard.tsx (estado inicial del formulario) — mismo patrón
 * que testEmergenciaDefaults.ts/kitEmergenciaDefaults.ts. Arranca en blanco
 * (no con los datos de ejemplo "Diego Tinoco" del archivo original) para
 * que cada asesor lo complete con lo suyo — salvo `title`, que igual que en
 * los demás templates arranca con el mismo texto genérico que ya traía el
 * archivo original. A diferencia de Meta Universitaria/Kit Emergencia/Test
 * de Preparación, el archivo original de este template NO tiene un campo
 * `email` en su CONFIG (no lo usa en ningún lado del JS) — no se agrega
 * acá tampoco, sería inventar un campo que el archivo verbatim no expone. */

export interface DiagnosticoSaludBrand {
  advisorName: string;
  title: string;
  whatsapp: string;
  photoURL: string;
  logoURL: string;
  colorMarca: string;
  calendlyURL: string;
  privacyURL: string;
  webhookURL: string;
  /** Las 4 URLs de recursos complementarios que `paintReco()` ofrece según
   * cuál de los 6 pilares salió peor — ver CONFIG.urlRetiro/urlEmergencia/
   * urlUniversidad/urlProteccion en el archivo original. Ninguna de las 4
   * apunta a un Mini App de este proyecto por defecto (queda a criterio del
   * asesor pegar la URL de su Calculadora de Brecha de Retiro, su Meta
   * Universitaria, etc. si ya las tiene armadas) — mismo criterio "dejar
   * preparado, no auto-inferir" que urlFondoEmergencia en
   * testEmergenciaDefaults.ts. */
  urlRetiro: string;
  urlEmergencia: string;
  urlUniversidad: string;
  urlProteccion: string;
}

export const DEFAULT_DIAGNOSTICO_SALUD_BRAND: DiagnosticoSaludBrand = {
  advisorName: "",
  title: "Asesor financiero",
  whatsapp: "",
  photoURL: "",
  logoURL: "",
  colorMarca: "",
  calendlyURL: "",
  privacyURL: "",
  webhookURL: "",
  urlRetiro: "",
  urlEmergencia: "",
  urlUniversidad: "",
  urlProteccion: "",
};

/** Los 6 pilares que computeScores() calcula en el archivo original
 * (state.scores) — mismas claves que usa orderedPriorities()/prioridad1-3. */
const DIAGNOSTICO_SALUD_PILLARS = ["liquidez", "ahorro", "deuda", "proteccion", "retiro", "patrimonio"] as const;
export type DiagnosticoSaludPillar = (typeof DIAGNOSTICO_SALUD_PILLARS)[number];

export const DIAGNOSTICO_SALUD_PILLAR_LABELS: Record<DiagnosticoSaludPillar, string> = {
  liquidez: "Liquidez",
  ahorro: "Ahorro",
  deuda: "Deuda",
  proteccion: "Protección",
  retiro: "Retiro",
  patrimonio: "Patrimonio",
};

export interface DiagnosticoSaludLeadInput {
  financialScore: unknown;
  scoreLiquidez: unknown;
  scoreAhorro: unknown;
  scoreDeuda: unknown;
  scoreProteccion: unknown;
  scoreRetiro: unknown;
  scorePatrimonio: unknown;
  prioridad1: unknown;
  prioridad2: unknown;
  prioridad3: unknown;
}

export interface DiagnosticoSaludSanitizedLead {
  financialScore: number;
  scoreLiquidez: number | null;
  scoreAhorro: number | null;
  scoreDeuda: number | null;
  scoreProteccion: number | null;
  scoreRetiro: number | null;
  scorePatrimonio: number | null;
  prioridad1: DiagnosticoSaludPillar | null;
  prioridad2: DiagnosticoSaludPillar | null;
  prioridad3: DiagnosticoSaludPillar | null;
}

/** Mismo caso que testEmergenciaDefaults.ts: no hay recómputo server-side
 * "autoritativo" posible porque el archivo original solo manda las
 * respuestas individuales (`state.ans`) si `SEND_DETAILED_RESPONSES` — una
 * constante de ingeniería fuera del objeto CONFIG que esta integración
 * personaliza — está en `true`, y viene en `false` por diseño. Sin esas
 * respuestas no hay con qué reproducir server-side la redistribución de
 * ponderaciones de `computeScores()` (un pilar sin preguntas aplicables le
 * cede su peso a los demás) ni el manejo especial de la cobertura
 * multi-select de Protección.
 *
 * Se sanea en cambio: cada score se clampea a 0-100 SI es un número — a
 * diferencia de Test de Preparación (donde las 4 dimensiones siempre están
 * definidas), acá un pilar puede legítimamente venir en `null` ("No
 * aplica", ver `pbars` en el archivo original) cuando ninguna de sus
 * preguntas aplicó; por eso `null` se preserva tal cual en vez de
 * convertirse en 0 — un 0 sería un puntaje real (pésimo), mientras que
 * `null` significa "no evaluado", son cosas distintas y no hay que
 * confundirlas. Cualquier otro valor no numérico y no nulo (intento de
 * inyectar un string, por ejemplo) también cae a `null` por el mismo
 * motivo: no hay forma de saber si "debería" ser 0 o no aplicar. */
export function sanitizeDiagnosticoSaludLead(input: DiagnosticoSaludLeadInput): DiagnosticoSaludSanitizedLead {
  function clampScore(v: unknown): number {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
  }
  function clampPillarScore(v: unknown): number | null {
    if (v === null) return null;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : null;
  }
  function clampPillar(v: unknown): DiagnosticoSaludPillar | null {
    return typeof v === "string" && (DIAGNOSTICO_SALUD_PILLARS as readonly string[]).includes(v) ? (v as DiagnosticoSaludPillar) : null;
  }

  return {
    financialScore: clampScore(input.financialScore),
    scoreLiquidez: clampPillarScore(input.scoreLiquidez),
    scoreAhorro: clampPillarScore(input.scoreAhorro),
    scoreDeuda: clampPillarScore(input.scoreDeuda),
    scoreProteccion: clampPillarScore(input.scoreProteccion),
    scoreRetiro: clampPillarScore(input.scoreRetiro),
    scorePatrimonio: clampPillarScore(input.scorePatrimonio),
    prioridad1: clampPillar(input.prioridad1),
    prioridad2: clampPillar(input.prioridad2),
    prioridad3: clampPillar(input.prioridad3),
  };
}
