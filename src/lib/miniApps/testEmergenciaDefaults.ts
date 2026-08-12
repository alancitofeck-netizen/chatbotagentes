/** Config por defecto para "Test de Preparación para Emergencias Financieras"
 * (Emergency Readiness Score) — los campos del objeto `CONFIG` del HTML
 * original que sirvió de base a este tipo de Mini App. Única fuente de
 * verdad, importada tanto por queries.ts (relleno de defaults si `config`
 * viene vacío/incompleto) como por NewMiniAppWizard.tsx (estado inicial del
 * formulario) — mismo patrón que metaUniversitariaDefaults.ts/
 * kitEmergenciaDefaults.ts. Arranca en blanco (no con los datos de ejemplo
 * "Diego Tinoco" del archivo original) para que cada asesor lo complete con
 * lo suyo — salvo `title`/`seguroSaludNombre`, que igual que en
 * kitEmergenciaDefaults.ts arrancan con el mismo texto genérico que ya traía
 * el archivo original. */

export interface TestEmergenciaBrand {
  advisorName: string;
  title: string;
  whatsapp: string;
  email: string;
  photoURL: string;
  logoURL: string;
  colorMarca: string;
  calendlyURL: string;
  privacyURL: string;
  webhookURL: string;
  /** URL del Mini App "Kit de Emergencia Financiera Familiar" (u otro
   * recurso propio) que `paintReco()` ofrece como siguiente paso — ver
   * CONFIG.urlKitEmergencia en el archivo original. */
  kitEmergenciaURL: string;
  /** URL de una futura calculadora de fondo de emergencia — ver
   * CONFIG.urlFondoEmergencia en el archivo original. Ninguna Mini App de
   * ese tipo existe todavía en este proyecto; el campo queda listo para
   * cuando exista, igual que el resto de la arquitectura "dejar preparado
   * para después" ya usada en otros módulos (ver plan de Clientes). */
  fondoEmergenciaURL: string;
  seguroSaludNombre: string;
}

export const DEFAULT_TEST_EMERGENCIA_BRAND: TestEmergenciaBrand = {
  advisorName: "",
  title: "Asesor financiero",
  whatsapp: "",
  email: "",
  photoURL: "",
  logoURL: "",
  colorMarca: "",
  calendlyURL: "",
  privacyURL: "",
  webhookURL: "",
  kitEmergenciaURL: "",
  fondoEmergenciaURL: "",
  seguroSaludNombre: "Seguro de Gastos Médicos Mayores",
};

/** Las 4 dimensiones que computeScores() calcula en el archivo original
 * (state.dims) — mismas claves que usa orderedDims()/prioridad1-3. */
const TEST_EMERGENCIA_DIMENSIONS = ["reserva", "liquidez", "resiliencia", "proteccion"] as const;
export type TestEmergenciaDimension = (typeof TEST_EMERGENCIA_DIMENSIONS)[number];

export const TEST_EMERGENCIA_DIMENSION_LABELS: Record<TestEmergenciaDimension, string> = {
  reserva: "Reserva",
  liquidez: "Liquidez",
  resiliencia: "Resiliencia",
  proteccion: "Protección",
};

/** Las 5 categorías que mesesCategoria() puede devolver — mismo texto
 * literal (incluye el guion en; U+2013) que el archivo original. */
const TEST_EMERGENCIA_MESES_CATEGORIAS = ["menos de 1 mes", "1–2 meses", "3–5 meses", "6–12 meses", "más de 12 meses"] as const;
export type TestEmergenciaMesesCategoria = (typeof TEST_EMERGENCIA_MESES_CATEGORIAS)[number];

export interface TestEmergenciaLeadInput {
  emergencyScore: unknown;
  scoreReserva: unknown;
  scoreLiquidez: unknown;
  scoreResiliencia: unknown;
  scoreProteccion: unknown;
  mesesRespaldoCategoria: unknown;
  numeroDependientes: unknown;
  prioridad1: unknown;
  prioridad2: unknown;
  prioridad3: unknown;
}

export interface TestEmergenciaSanitizedLead {
  emergencyScore: number;
  scoreReserva: number;
  scoreLiquidez: number;
  scoreResiliencia: number;
  scoreProteccion: number;
  mesesRespaldoCategoria: TestEmergenciaMesesCategoria | null;
  numeroDependientes: number;
  prioridad1: TestEmergenciaDimension | null;
  prioridad2: TestEmergenciaDimension | null;
  prioridad3: TestEmergenciaDimension | null;
}

/** A diferencia de las calculadoras de este proyecto (Diagnóstico de
 * Solidez, Meta Universitaria), acá tampoco hay un recómputo server-side
 * "autoritativo" posible — mismo caso que Kit Emergencia, aunque por un
 * motivo distinto. El archivo original SÍ calcula el score a partir de
 * respuestas individuales (`state.ans`, vía `applyContext()` +
 * `computeScores()`, con redistribución de ponderaciones según cuántos
 * dependientes económicos declaró la persona), pero esas respuestas crudas
 * solo viajan al CRM si `SEND_DETAILED_RESPONSES` (una constante de
 * ingeniería del propio archivo, declarada FUERA del objeto `CONFIG` que su
 * propio comentario dice que es "lo único" que se debe personalizar por
 * asesor) está en `true` — y en el archivo tal cual vino, arranca en
 * `false`. Cambiar ese flag sería modificar la lógica/el comportamiento de
 * privacidad que el propio archivo definió a propósito, exactamente lo que
 * esta integración nunca hace. Mientras `SEND_DETAILED_RESPONSES` siga en
 * `false`, `buildLead()` nunca manda `respuestas`, así que no hay con qué
 * recomputar `applyContext()`/`computeScores()` server-side sin producir un
 * número inventado a partir de datos que no llegaron.
 *
 * Lo que sí hace esta función es sanear/acotar lo que llega: clampea cada
 * score a 0-100, valida `mesesRespaldoCategoria` contra las 5 categorías
 * reales, fuerza `numeroDependientes` a un entero no negativo, y valida
 * `prioridad1/2/3` contra las 4 claves de dimensión reales — así un payload
 * manipulado no puede inyectar un score fuera de rango ni una dimensión que
 * no existe. */
export function sanitizeTestEmergenciaLead(input: TestEmergenciaLeadInput): TestEmergenciaSanitizedLead {
  function clampScore(v: unknown): number {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : 0;
  }
  function clampDimension(v: unknown): TestEmergenciaDimension | null {
    return typeof v === "string" && (TEST_EMERGENCIA_DIMENSIONS as readonly string[]).includes(v) ? (v as TestEmergenciaDimension) : null;
  }

  const mesesRespaldoCategoria =
    typeof input.mesesRespaldoCategoria === "string" && (TEST_EMERGENCIA_MESES_CATEGORIAS as readonly string[]).includes(input.mesesRespaldoCategoria)
      ? (input.mesesRespaldoCategoria as TestEmergenciaMesesCategoria)
      : null;

  const rawDeps = typeof input.numeroDependientes === "number" ? input.numeroDependientes : Number(input.numeroDependientes);
  const numeroDependientes = Number.isFinite(rawDeps) && rawDeps >= 0 ? Math.round(rawDeps) : 0;

  return {
    emergencyScore: clampScore(input.emergencyScore),
    scoreReserva: clampScore(input.scoreReserva),
    scoreLiquidez: clampScore(input.scoreLiquidez),
    scoreResiliencia: clampScore(input.scoreResiliencia),
    scoreProteccion: clampScore(input.scoreProteccion),
    mesesRespaldoCategoria,
    numeroDependientes,
    prioridad1: clampDimension(input.prioridad1),
    prioridad2: clampDimension(input.prioridad2),
    prioridad3: clampDimension(input.prioridad3),
  };
}
