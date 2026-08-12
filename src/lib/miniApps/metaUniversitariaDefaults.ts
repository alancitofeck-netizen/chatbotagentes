/** Config por defecto para "Calculadora de Meta Universitaria" — los campos
 * del objeto `CONFIG` del HTML original que sirvió de base a este tipo de
 * Mini App. Única fuente de verdad, importada tanto por queries.ts (relleno
 * de defaults si `config` viene vacío/incompleto) como por
 * NewMiniAppWizard.tsx (estado inicial del formulario) — mismo patrón que
 * diagnosticoSolidezDefaults.ts/calculadoraIngresosDefaults.ts. Arranca en
 * blanco (no con los datos de ejemplo "Diego Tinoco" del archivo original)
 * para que cada asesor lo complete con lo suyo. */

export interface MetaUniversitariaBrand {
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
  monedaDefault: string;
  /** Ratio (0.06 = 6%), no porcentaje — mismo shape que el CONFIG original. */
  inflacionEducativaDefault: number;
  rendimientoAnualDefault: number;
}

export const DEFAULT_META_UNIVERSITARIA_BRAND: MetaUniversitariaBrand = {
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
  monedaDefault: "MXN",
  inflacionEducativaDefault: 0.06,
  rendimientoAnualDefault: 0.06,
};

export interface MetaUniversitariaInputs {
  /** Años restantes hasta el inicio de la universidad (edadUniversidad - edadHijo). */
  n: number;
  /** Duración de la carrera, en años. */
  dur: number;
  /** Inflación educativa anual, en PORCENTAJE (ej. 6 = 6%). */
  inflPct: number;
  /** Costo anual estimado hoy (ya incluye gastos adicionales). */
  annualToday: number;
  capitalNow: number;
  monthlyNow: number;
}

export interface MetaUniversitariaResult {
  n: number;
  dur: number;
  totalToday: number;
  totalFuture: number;
  capProjected: number;
  gap: number;
  monthly: number;
}

function fvLump(pv: number, r: number, years: number): number {
  return pv * Math.pow(1 + r, years);
}

function fvAnnuity(pmt: number, r: number, years: number): number {
  if (pmt <= 0 || years <= 0) return 0;
  const i = r / 12;
  const n = years * 12;
  if (i === 0) return pmt * n;
  return (pmt * (Math.pow(1 + i, n) - 1)) / i;
}

function pmtForFV(fv: number, r: number, years: number): number {
  if (fv <= 0) return 0;
  if (years <= 0) return fv;
  const i = r / 12;
  const n = years * 12;
  if (i === 0) return fv / n;
  return (fv * i) / (Math.pow(1 + i, n) - 1);
}

/** Recómputo autoritativo — mismo motor que `calc()` en el template
 * verbatim (metaUniversitariaTemplate.ts), reconstruido acá para que el
 * servidor nunca confíe en `costoFuturoEstimado`/`brechaEstimada`/
 * `metaMensualEstimada` que manda el navegador (ver ingest.ts). Usa la tasa
 * de rendimiento del workspace (config.brand.rendimientoAnualDefault), no
 * un valor que mande el cliente. */
export function computeMetaUniversitariaResult(inputs: MetaUniversitariaInputs, rendimientoAnual: number = 0.06): MetaUniversitariaResult | null {
  const { n, dur, inflPct, annualToday, capitalNow, monthlyNow } = inputs;
  if (!Number.isFinite(n) || n < 0) return null;
  if (!Number.isFinite(dur) || dur <= 0) return null;
  if (!Number.isFinite(annualToday) || annualToday < 0) return null;
  const infl = inflPct / 100;
  const r = rendimientoAnual;

  const totalToday = annualToday * dur;
  let totalFuture = 0;
  for (let k = 0; k < dur; k++) {
    totalFuture += annualToday * Math.pow(1 + infl, n + k);
  }

  const capProjected = fvLump(capitalNow, r, n) + fvAnnuity(monthlyNow, r, n);
  const gap = Math.max(0, totalFuture - capProjected);
  const monthly = pmtForFV(gap, r, n);

  return { n, dur, totalToday, totalFuture, capProjected, gap, monthly };
}
