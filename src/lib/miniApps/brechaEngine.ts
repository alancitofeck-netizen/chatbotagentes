/**
 * Brecha-de-retiro (IMSS pension-gap) projection engine — deliberately
 * isolated in this one file, same "pure, no I/O, safe for client AND
 * server" posture as financialEngine.ts. Both the public page (result
 * screen) and ingest.ts (authoritative recompute at lead-submission time)
 * call this same function — never trust a client-sent computed number.
 *
 * This is a heuristic ESTIMATE against IMSS's own published régimen rules
 * (Ley 73 / Ley 97), not an official IMSS calculation — every consumer
 * must keep presenting it as an estimate (see the disclaimer text carried
 * in CalculadoraBrechaApp.tsx).
 */

export type Regimen = "73" | "97" | "unknown";

/** Human-readable label for each régimen — used when persisting to
 * mini_app_leads.data (CRM-visible) so the stored value is legible text,
 * never the internal code, same principle already applied to the
 * retirement simulator's own qualification answers. */
export const REGIMEN_LABELS: Record<Regimen, string> = {
  "73": "Ley 73",
  "97": "Ley 97",
  unknown: "Por confirmar",
};

export interface BrechaRetiroInput {
  regimen: Regimen;
  edad: number;
  retiroDeseado: number;
  sueldoMensual: number;
  semanasCotizadas: number | null;
  ahorroMensual: number;
}

export interface BrechaRetiroResult {
  tipo: Regimen;
  have: number;
  haveLbl: string;
  need: number;
  needLbl: string;
  gap: number;
  gapLbl: string;
  gapPer: string;
  metaRef: number;
  resEyebrow: string;
  /** e.g. ", tienes una ventaja" — the component prepends the visitor's
   * first name, matching the original's own `primerNombre + resTitle` join. */
  resTitleSuffix: string;
  resSub: string;
  gapExpl: string;
  facts: [string, string, string];
}

/** "Retiro digno" heuristic — 75% income replacement, same constant across
 * all 3 régimen branches (not user-configurable, an internal presentation
 * choice — mirrors RECOMMENDED_INCOME_REPLACEMENT_PCT's own posture in
 * financialEngine.ts). */
const RETIRO_DIGNO_REPLACEMENT_PCT = 75;

const DEFAULT_SEMANAS_COTIZADAS = 750;

export function calculateBrechaRetiro(input: BrechaRetiroInput): BrechaRetiroResult {
  const meta = input.sueldoMensual * (RETIRO_DIGNO_REPLACEMENT_PCT / 100);

  if (input.regimen === "73") {
    const sem = input.semanasCotizadas ?? DEFAULT_SEMANAS_COTIZADAS;
    const factor = Math.min(0.85, 0.4 + (Math.max(0, sem - 500) / 1500) * 0.45);
    const pensionActual = input.sueldoMensual * factor;
    const pensionM40 = Math.min(input.sueldoMensual * 0.95, pensionActual * 1.6);
    return {
      tipo: "73",
      have: pensionActual,
      haveLbl: "Pensión hoy",
      need: pensionM40,
      needLbl: "Con Mod. 40",
      gap: pensionM40 - pensionActual,
      gapLbl: "Lo que estás dejando sobre la mesa",
      gapPer: "al mes, cada mes, de por vida",
      metaRef: meta,
      resEyebrow: "Régimen Ley 73 · buena noticia",
      resTitleSuffix: ", tienes una ventaja",
      resSub: "Tu pensión es vitalicia y calculada sobre tu salario. El detalle: se puede optimizar.",
      gapExpl:
        "Con <b>Modalidad 40</b> podrías aumentar tu salario base de cotización y, con ello, tu pensión de por vida. Requiere aportaciones voluntarias durante varios años: hay un punto óptimo según tu presupuesto. <b>Tu asesor calcula si te conviene y cuánto.</b>",
      facts: [
        "La Ley 73 exige mínimo <b>500 semanas</b> cotizadas y paga pensión vitalicia garantizada.",
        "La Modalidad 40 mejora matemáticamente la pensión, pero necesita capital sostenido: no a todos les conviene igual.",
        "La edad de retiro (60 cesantía / 65 vejez) cambia el porcentaje que recibes.",
      ],
    };
  }

  if (input.regimen === "97") {
    const afore = input.sueldoMensual * 0.3;
    const extra = input.ahorroMensual * 0.5;
    const have = afore + extra;
    return {
      tipo: "97",
      have,
      haveLbl: "Con tu AFORE",
      need: meta,
      needLbl: "Retiro digno",
      gap: Math.max(0, meta - have),
      gapLbl: "Tu brecha mensual",
      gapPer: "al mes que te faltarían para vivir como hoy",
      metaRef: meta,
      resEyebrow: "Régimen Ley 97",
      resTitleSuffix: ", esto es tu realidad",
      resSub: "Tu pensión depende del saldo de tu AFORE, y para la mayoría eso no alcanza.",
      gapExpl:
        "La AFORE por sí sola suele reemplazar cerca del <b>30%</b> de tu último sueldo. Un plan privado de retiro complementa esa diferencia con aportaciones flexibles y beneficios fiscales. <b>Tu asesor arma el plan a tu medida.</b>",
      facts: [
        "En 2026, la Ley 97 pide <b>875 semanas</b> cotizadas, subiendo hasta 1,000 en 2031.",
        "La pensión sale de tu cuenta individual: mientras más aportes y antes empieces, mayor será.",
        "Un plan privado ofrece deducibilidad fiscal y puede contratarse en pesos, dólares o UDIs.",
      ],
    };
  }

  // "unknown" — visitor picked "No lo sé"
  const afore = input.sueldoMensual * 0.32;
  return {
    tipo: "unknown",
    have: afore,
    haveLbl: "Estimado base",
    need: meta,
    needLbl: "Retiro digno",
    gap: Math.max(0, meta - afore),
    gapLbl: "Tu brecha estimada",
    gapPer: "al mes (por confirmar tu régimen)",
    metaRef: meta,
    resEyebrow: "Régimen por confirmar",
    resTitleSuffix: ", primero definamos tu régimen",
    resSub: "Según tu fecha de primera cotización serás Ley 73 o Ley 97, y eso cambia todo.",
    gapExpl:
      "Este es un estimado base. <b>Tu asesor confirma tu régimen</b> con tu número de seguridad social y te da el cálculo real y tus opciones para cerrar la brecha.",
    facts: [
      "Si empezaste a cotizar <b>antes del 1 de julio de 1997</b> eres Ley 73; después, Ley 97.",
      "Puedes revisar tu fecha y semanas en el portal <b>Mi IMSS</b>, gratis.",
      "Cada régimen tiene estrategias distintas para mejorar tu pensión.",
    ],
  };
}
