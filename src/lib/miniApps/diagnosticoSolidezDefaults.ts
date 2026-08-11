/** Config por defecto para "Diagnóstico de Solidez Financiera" — los campos
 * de `BRAND_CONFIG` y la paleta activa (`THEME_ACTIVE`) del HTML original
 * que sirvió de base a este tipo de Mini App. Única fuente de verdad,
 * importada tanto por queries.ts (relleno de defaults si `config` viene
 * vacío/incompleto) como por NewMiniAppWizard.tsx (estado inicial del
 * formulario) — mismo patrón que diagnosticoDefaults.ts. Arranca en blanco
 * (no con los datos de ejemplo "Patricio Jaik" del archivo original) para
 * que cada asesor lo complete con lo suyo, igual que DEFAULT_DIAGNOSTICO_AGENTE. */

export type DiagnosticoSolidezTheme = "brass" | "navy" | "emerald" | "wine" | "copper";

export interface DiagnosticoSolidezBrand {
  advisorName: string;
  companyName: string;
  title: string;
  badge: string;
  photoURL: string;
  logoURL: string;
  whatsapp: string;
  calendly: string;
  privacyURL: string;
  advisorID: string;
  webhookURL: string;
  waGreeting: string;
}

export const DEFAULT_DIAGNOSTICO_SOLIDEZ_BRAND: DiagnosticoSolidezBrand = {
  advisorName: "",
  companyName: "",
  title: "Asesor patrimonial",
  badge: "",
  photoURL: "",
  logoURL: "",
  whatsapp: "",
  calendly: "",
  privacyURL: "",
  advisorID: "",
  webhookURL: "",
  waGreeting: "Hola, acabo de realizar el Diagnóstico de Solidez Financiera y me gustaría entender mejor mi resultado.",
};

export const DEFAULT_DIAGNOSTICO_SOLIDEZ_THEME: DiagnosticoSolidezTheme = "brass";

export const DIAGNOSTICO_SOLIDEZ_THEME_OPTIONS: { key: DiagnosticoSolidezTheme; label: string; swatch: string }[] = [
  { key: "brass", label: "Bronce", swatch: "#B08D4C" },
  { key: "navy", label: "Marino", swatch: "#3B82C4" },
  { key: "emerald", label: "Esmeralda", swatch: "#2E9E7B" },
  { key: "wine", label: "Vino", swatch: "#A6486B" },
  { key: "copper", label: "Cobre", swatch: "#C17A45" },
];
