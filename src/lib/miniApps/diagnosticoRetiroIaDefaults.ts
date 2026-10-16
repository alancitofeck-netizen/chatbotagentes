/** Config por defecto para "Diagnóstico de Retiro con IA" — los campos del
 * objeto `CONFIG` del HTML original que sirvió de base a este tipo de Mini
 * App (diagnostico-retiro-sujey.html). Única fuente de verdad, importada
 * tanto por queries.ts (relleno de defaults si `config` viene vacío) como
 * por diagnosticoRetiroIaTemplate.ts a través de DiagnosticoRetiroIaApp.tsx
 * — mismo patrón que ahorroFiscalDefaults.ts. Plantilla separada y
 * autocontenida (motor de preguntas/scoring hardcodeado en el template, sin
 * wizard de edición) a pedido explícito del usuario, en vez de extender el
 * motor configurable ya existente de "Diagnóstico Financiero - Retiro"
 * (diagnosticoRetiroDefaults.ts) — esta versión agrega secciones ("Tus
 * números" en $, escenarios concretos, insights cruzados) que ese motor no
 * tiene. */

export interface DiagnosticoRetiroIaBrand {
  agente: string;
  titulo: string;
  whatsapp: string;
  photoURL: string;
  /** Identificador corto usado en el parámetro `?ref=` al compartir
   * (equivalente a `agenteID` en el archivo original). */
  agenteID: string;
  colorMarca: string;
  calendlyURL: string;
  avisoPrivacidadURL: string;
  webhookURL: string;
  /** Link opcional a una Calculadora de Brecha de Retiro / "Finanzas
   * Reales" ya publicada del mismo asesor (recurso relacionado). */
  urlCalculadoraRetiro: string;
  /** Ídem para un Diagnóstico Financiero con IA (mini-app hermana). */
  urlSaludFinanciera: string;
}

export const DEFAULT_DIAGNOSTICO_RETIRO_IA_BRAND: DiagnosticoRetiroIaBrand = {
  agente: "",
  titulo: "Asesor financiero",
  whatsapp: "",
  photoURL: "",
  agenteID: "",
  colorMarca: "#0B2544",
  calendlyURL: "",
  avisoPrivacidadURL: "",
  webhookURL: "",
  urlCalculadoraRetiro: "",
  urlSaludFinanciera: "",
};
