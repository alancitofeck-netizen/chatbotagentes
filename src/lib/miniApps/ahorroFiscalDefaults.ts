/** Config por defecto para "Calculadora de Ahorro Fiscal" — los campos del
 * objeto `CONFIG` del HTML original que sirvió de base a este tipo de Mini
 * App. Única fuente de verdad, importada tanto por queries.ts (relleno de
 * defaults si `config` viene vacío/incompleto) como por
 * NewMiniAppWizard.tsx (estado inicial del formulario) — mismo patrón que
 * metaUniversitariaDefaults.ts. Arranca en blanco (nombre/whatsapp/etc.)
 * salvo `credenciales`, que en el archivo original ya son 3 líneas
 * genéricas reutilizables por cualquier asesor, no un dato de ejemplo a
 * blanquear.
 *
 * `TAX_CONFIG` (motor fiscal ISR/PPR/EFI/colegiaturas 2026) NO es parte de
 * `AhorroFiscalBrand` — el archivo original lo separa a propósito de
 * `CONFIG` ("Para actualizar a 2027: modificar únicamente TAX_CONFIG"): es
 * el mismo motor para cualquier instancia de este Mini App, no algo que un
 * asesor deba poder editar desde el wizard. */

export interface AhorroFiscalBrand {
  advisorName: string;
  title: string;
  whatsapp: string;
  email: string;
  photoURL: string;
  logoURL: string;
  calendlyURL: string;
  webhookURL: string;
  avisoPrivacidadURL: string;
  colorMarca: string;
  /** Link opcional a una Calculadora de Brecha de Retiro ya publicada del
   * mismo asesor (recurso relacionado, mostrado al final del resultado). */
  urlRetiro: string;
  /** Ídem para un Diagnóstico de Solidez Financiera ya publicado. */
  urlDiagnostico: string;
  credenciales: string[];
}

export const DEFAULT_AHORRO_FISCAL_BRAND: AhorroFiscalBrand = {
  advisorName: "",
  title: "Asesor financiero",
  whatsapp: "",
  email: "",
  photoURL: "",
  logoURL: "",
  calendlyURL: "",
  webhookURL: "",
  avisoPrivacidadURL: "",
  colorMarca: "",
  urlRetiro: "",
  urlDiagnostico: "",
  credenciales: ["Agente certificado", "Asesoría personalizada para tu perfil", "Vía WhatsApp o videollamada, a tu conveniencia"],
};

/* ============================================================
   MOTOR FISCAL — espejo server-side, literal, de TAX_CONFIG y las
   funciones puras del template (diagnosticoSolidezDefaults.ts-style:
   nunca se confía en un cálculo que mande el navegador). Fuentes/vigencia
   documentadas en ahorroFiscalTemplate.ts, donde vive el original.
   ============================================================ */
const TAX_CONFIG = {
  uma: { anual: 42794.64 },
  deduccionesPersonales: { limitePctIngreso: 0.15, limiteUMA: 5 },
  ppr: { limitePctIngreso: 0.1, limiteUMA: 5 },
  efi: { limiteMonto: 152000 },
  colegiaturas: {
    preescolar: 14200,
    primaria: 12900,
    secundaria: 19900,
    profesionalTecnico: 17100,
    bachillerato: 24500,
  } as Record<string, number>,
  tablaISRAnual: [
    { li: 0.01, ls: 8952.49, cf: 0, pct: 0.0192 },
    { li: 8952.5, ls: 75984.55, cf: 171.88, pct: 0.064 },
    { li: 75984.56, ls: 133536.07, cf: 4461.94, pct: 0.1088 },
    { li: 133536.08, ls: 155229.8, cf: 10723.55, pct: 0.16 },
    { li: 155229.81, ls: 185852.57, cf: 14194.54, pct: 0.1792 },
    { li: 185852.58, ls: 374837.88, cf: 19682.13, pct: 0.2136 },
    { li: 374837.89, ls: 590795.99, cf: 60049.4, pct: 0.2352 },
    { li: 590796.0, ls: 1127926.84, cf: 110842.74, pct: 0.3 },
    { li: 1127926.85, ls: 1503902.46, cf: 271981.99, pct: 0.32 },
    { li: 1503902.47, ls: 4511707.37, cf: 392294.17, pct: 0.34 },
    { li: 4511707.38, ls: Infinity, cf: 1414947.85, pct: 0.35 },
  ],
};

function calculateISR(base: number): number {
  if (base <= 0) return 0;
  const tramo = TAX_CONFIG.tablaISRAnual.find((t) => base >= t.li && base <= t.ls);
  if (!tramo) return 0;
  return tramo.cf + (base - tramo.li) * tramo.pct;
}

function tasaMarginal(base: number): number {
  const tramo = TAX_CONFIG.tablaISRAnual.find((t) => base >= t.li && base <= t.ls);
  return tramo ? tramo.pct : 0;
}

function limiteDeduccionesGenerales(ingresoAnual: number): number {
  return Math.min(ingresoAnual * TAX_CONFIG.deduccionesPersonales.limitePctIngreso, TAX_CONFIG.deduccionesPersonales.limiteUMA * TAX_CONFIG.uma.anual);
}

function limitePPR(ingresoAnual: number): number {
  return Math.min(ingresoAnual * TAX_CONFIG.ppr.limitePctIngreso, TAX_CONFIG.ppr.limiteUMA * TAX_CONFIG.uma.anual);
}

export interface AhorroFiscalDeductionItems {
  medicos: number;
  dentales: number;
  hospitalarios: number;
  seguroGMM: number;
  interesesHipotecarios: number;
  donativos: number;
  transporteEscolar: number;
  otros: number;
  /** Clave de TAX_CONFIG.colegiaturas ("" si no aplica) — el tope se
   * resuelve acá server-side a partir de la clave, nunca de un monto/tope
   * que mande el cliente. */
  colegiaturasNivel: string;
  colegiaturasMonto: number;
}

export interface AhorroFiscalInputs {
  ingresoAnual: number;
  /** null = "no lo sé" (el visitante tildó el checkbox correspondiente). */
  isrRetenido: number | null;
  deducciones: AhorroFiscalDeductionItems;
  pprEstado: "si" | "no" | "evaluando" | "";
  /** Monto único ya resuelto (pprActual si pprEstado 'si', si no pprSim) —
   * mismo criterio que `computeAll()` en el template, que resuelve esto
   * antes de calcular. */
  pprMonto: number;
  efiMonto: number;
}

export interface AhorroFiscalResult {
  ingreso: number;
  dedTotalAplicado: number;
  pprAplicada: number;
  efiAplicada: number;
  baseSin: number;
  baseConTodo: number;
  isrSin: number;
  isrConTodo: number;
  ahorroFiscal: number;
  saldo: number | null;
  tasaMarginal: number;
  opportunityLevel: "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW";
}

/** Recómputo autoritativo — mismo motor que `computeAll()`/`opportunityLevel()`
 * en el template verbatim, reconstruido acá para que el servidor nunca
 * confíe en `ahorroFiscalEstimado`/`saldoFavorEstimado`/`opportunityLevel`
 * que manda el navegador (ver ingest.ts). */
export function computeAhorroFiscalResult(inputs: AhorroFiscalInputs): AhorroFiscalResult | null {
  const { ingresoAnual, isrRetenido, deducciones, pprEstado, pprMonto, efiMonto } = inputs;
  if (!Number.isFinite(ingresoAnual) || ingresoAnual <= 0) return null;

  const sumaGeneral =
    Math.max(0, deducciones.medicos) +
    Math.max(0, deducciones.dentales) +
    Math.max(0, deducciones.hospitalarios) +
    Math.max(0, deducciones.seguroGMM) +
    Math.max(0, deducciones.interesesHipotecarios) +
    Math.max(0, deducciones.donativos) +
    Math.max(0, deducciones.transporteEscolar) +
    Math.max(0, deducciones.otros);
  const limiteGeneral = limiteDeduccionesGenerales(ingresoAnual);
  const generalAplicada = Math.min(sumaGeneral, limiteGeneral);

  const topeColegiatura = deducciones.colegiaturasNivel ? (TAX_CONFIG.colegiaturas[deducciones.colegiaturasNivel] ?? 0) : 0;
  const colegiaturasAplicada = Math.min(Math.max(0, deducciones.colegiaturasMonto), topeColegiatura);

  const dedTotalAplicado = generalAplicada + colegiaturasAplicada;

  const limitePprCalc = limitePPR(ingresoAnual);
  const pprAplicada = Math.min(Math.max(0, pprMonto), limitePprCalc);
  const efiAplicada = Math.min(Math.max(0, efiMonto), TAX_CONFIG.efi.limiteMonto);

  const baseSin = ingresoAnual;
  const baseConTodo = Math.max(0, ingresoAnual - (dedTotalAplicado + pprAplicada + efiAplicada));

  const isrSin = calculateISR(baseSin);
  const isrConTodo = calculateISR(baseConTodo);
  const ahorroFiscal = Math.max(0, isrSin - isrConTodo);
  const saldo = isrRetenido !== null ? isrRetenido - isrConTodo : null;

  const pct = ingresoAnual > 0 ? ahorroFiscal / ingresoAnual : 0;
  const brecha = limitePprCalc - pprAplicada;
  const interesPPR = pprEstado === "no" || pprEstado === "evaluando" ? 1 : 0;
  const score = pct * 100 + (brecha > 0 ? 10 : 0) + interesPPR * 10;
  const opportunityLevel = score >= 40 ? "VERY_HIGH" : score >= 22 ? "HIGH" : score >= 10 ? "MEDIUM" : "LOW";

  return {
    ingreso: ingresoAnual,
    dedTotalAplicado,
    pprAplicada,
    efiAplicada,
    baseSin,
    baseConTodo,
    isrSin,
    isrConTodo,
    ahorroFiscal,
    saldo,
    tasaMarginal: tasaMarginal(baseConTodo),
    opportunityLevel,
  };
}
