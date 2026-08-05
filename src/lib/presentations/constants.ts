/** Client-safe constants — mismo motivo que advisorySessions/constants.ts:
 * algunos componentes cliente necesitan estos valores en runtime, no solo
 * tipos, y un import de valor real desde un módulo "server-only" rompe el
 * build. */

export const PRESENTATION_STEPS = [
  { key: "informacion", label: "Información" },
  { key: "fotos", label: "Fotos" },
  { key: "servicios", label: "Servicios" },
  { key: "ia", label: "IA" },
  { key: "vista_previa", label: "Vista previa" },
  { key: "finalizar", label: "Finalizar" },
] as const;

export type PresentationStep = (typeof PRESENTATION_STEPS)[number]["key"];

export const PRESENTATION_STATUSES = ["borrador", "generando", "lista", "archivada"] as const;
export type PresentationStatus = (typeof PRESENTATION_STATUSES)[number];

export const PRESENTATION_STATUS_LABEL: Record<PresentationStatus, string> = {
  borrador: "Borrador",
  generando: "Generando",
  lista: "Lista",
  archivada: "Archivada",
};

export const PRESENTATION_STATUS_VARIANT: Record<PresentationStatus, "neutral" | "warning" | "success" | "info"> = {
  borrador: "neutral",
  generando: "warning",
  lista: "success",
  archivada: "neutral",
};

export interface PresentationPhoto {
  id: string;
  originalPath: string;
  /** Ruta elegida para usar en la presentación — igual a originalPath hasta
   * que exista una Fase 2 de IA de fotos real y el usuario elija la versión
   * mejorada. */
  selectedPath: string;
  /** null hasta la Fase 2 — el botón "Mejorar con IA" no genera esto todavía. */
  enhancedPath: string | null;
  cropMeta: { x: number; y: number; width: number; height: number; rotation: number } | null;
}

export interface PresentationSlide {
  key: string;
  title: string;
  body: string;
  order: number;
}

export const DEFAULT_SLIDE_KEYS = ["portada", "sobre_mi", "servicios", "beneficios", "casos_exito", "testimonios", "contacto"] as const;

export const SLIDE_LABEL: Record<string, string> = {
  portada: "Portada",
  sobre_mi: "Sobre mí",
  servicios: "Servicios",
  beneficios: "Beneficios",
  casos_exito: "Casos de éxito",
  testimonios: "Testimonios",
  contacto: "Contacto",
};

export interface PersonalInfo {
  firstName?: string;
  lastName?: string;
  profession?: string;
  company?: string;
  specialty?: string;
  country?: string;
  city?: string;
  bio?: string;
  yearsExperience?: number;
  socialMedia?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  logoPath?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
}

export interface CommercialInfo {
  services?: string;
  products?: string;
  averageValue?: number;
  currency?: string;
  benefits?: string;
  differentiators?: string;
  successCases?: string;
  awards?: string;
  certifications?: string;
}

export const DEFAULT_PRIMARY_COLOR = "#6366F1";
export const DEFAULT_SECONDARY_COLOR = "#0EA5E9";
export const FONT_OPTIONS = ["Inter", "Poppins", "Playfair Display", "Manrope", "Sora"];
export const CURRENCY_OPTIONS = ["USD", "MXN", "ARS", "EUR", "COP", "CLP", "PEN"];

/** Mensajes rotando durante "Generar con IA" — no existe un patrón de
 * progreso real en el proyecto para tareas largas de IA (confirmado antes
 * de diseñar esto), así que es una animación simple client-side, no un
 * reflejo de trabajo real por etapas. */
export const AI_GENERATION_MESSAGES = [
  "Analizando información…",
  "Generando diseño…",
  "Creando presentación…",
  "Optimizando imágenes…",
  "Escribiendo contenido…",
  "Generando diapositivas…",
  "Preparando versión móvil…",
  "Preparando versión para compartir…",
] as const;
