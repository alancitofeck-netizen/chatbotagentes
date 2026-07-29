/**
 * Canonical option lists for the retirement simulator's lead-qualification
 * questions — pure, no I/O, shared between the client (renders the pickers),
 * `ingest.ts` (resolves code -> label at persistence time) and the CRM's
 * "Diagnóstico del simulador" panel. Same posture as financialEngine.ts/
 * resultDiagnostics.ts: one source of truth importable from both bundles.
 */

export interface QualificationOption {
  value: string;
  label: string;
}

export const PREOCUPACION_OPTIONS: QualificationOption[] = [
  { value: "no_se_cuanto", label: "No sé cuánto voy a recibir." },
  { value: "retirarme_antes", label: "Quiero retirarme antes." },
  { value: "pension_insuficiente", label: "Mi pensión será insuficiente." },
  { value: "proteger_familia", label: "Quiero proteger a mi familia." },
  { value: "solo_conocer", label: "Solo quería conocer mi situación." },
];

export const HABLO_ASESOR_OPTIONS: QualificationOption[] = [
  { value: "si", label: "Sí" },
  { value: "no", label: "No" },
];

export const OBJETIVO_OPTIONS: QualificationOption[] = [
  { value: "mejorar_retiro", label: "Mejorar mi retiro." },
  { value: "reducir_impuestos", label: "Reducir impuestos." },
  { value: "invertir_mejor", label: "Invertir mejor." },
  { value: "proteger_patrimonio", label: "Proteger mi patrimonio." },
  { value: "no_seguro", label: "No estoy seguro." },
];

export const CUANDO_OPTIONS: QualificationOption[] = [
  { value: "esta_semana", label: "Esta semana." },
  { value: "este_mes", label: "Este mes." },
  { value: "mas_adelante", label: "Más adelante." },
];

export function labelFor(options: QualificationOption[], code: string | null): string | null {
  if (!code) return null;
  return options.find((o) => o.value === code)?.label ?? null;
}

export function preocupacionLabel(code: string | null): string | null {
  return labelFor(PREOCUPACION_OPTIONS, code);
}

export function habloAsesorLabel(code: string | null): string | null {
  return labelFor(HABLO_ASESOR_OPTIONS, code);
}

export function objetivoLabel(code: string | null): string | null {
  return labelFor(OBJETIVO_OPTIONS, code);
}

export function cuandoEmpezarLabel(code: string | null): string | null {
  return labelFor(CUANDO_OPTIONS, code);
}

/** Fuller phrase for CRM display only (per "Experiencia previa: Nunca
 * trabajó con un asesor financiero" requirement) — deliberately separate
 * from habloAsesorLabel, which stays the literal short pill text ("Sí"/"No")
 * since that's what data.qualification.habloAsesor.label stores. */
export const HABLO_ASESOR_FULL_PHRASE: Record<"si" | "no", string> = {
  si: "Ya había hablado con un asesor financiero antes.",
  no: "Nunca había trabajado con un asesor financiero.",
};

export function habloAsesorFullPhrase(code: string | null): string {
  if (code === "si" || code === "no") return HABLO_ASESOR_FULL_PHRASE[code];
  return "Sin responder todavía.";
}
