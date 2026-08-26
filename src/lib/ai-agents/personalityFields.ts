import type { AgentPersonality } from "@/lib/ai-agents/queries";

/** Compartido entre PersonalityTab.tsx (post-creación) y el wizard de
 * creación (StepBrain.tsx) — una sola definición de los 7 dials reales. */
export const PERSONALITY_FIELDS: {
  key: keyof AgentPersonality;
  label: string;
  options: { value: string; label: string }[];
}[] = [
  {
    key: "formality",
    label: "Formalidad",
    options: [
      { value: "baja", label: "Baja" },
      { value: "media", label: "Media" },
      { value: "alta", label: "Alta" },
    ],
  },
  {
    key: "warmth",
    label: "Cercanía",
    options: [
      { value: "baja", label: "Baja" },
      { value: "media", label: "Media" },
      { value: "alta", label: "Alta" },
    ],
  },
  {
    key: "directness",
    label: "Estilo",
    options: [
      { value: "directo", label: "Directo" },
      { value: "equilibrado", label: "Equilibrado" },
      { value: "indirecto", label: "Indirecto" },
    ],
  },
  {
    key: "emojiUsage",
    label: "Uso de emojis",
    options: [
      { value: "ninguno", label: "Ninguno" },
      { value: "bajo", label: "Bajo" },
      { value: "medio", label: "Medio" },
      { value: "alto", label: "Alto" },
    ],
  },
  {
    key: "messageLength",
    label: "Longitud de mensajes",
    options: [
      { value: "cortos", label: "Cortos" },
      { value: "medios", label: "Medios" },
      { value: "largos", label: "Largos" },
    ],
  },
  {
    key: "questioningStyle",
    label: "Preguntas",
    options: [
      { value: "poco", label: "Poco frecuentes" },
      { value: "moderado", label: "Moderadas" },
      { value: "frecuente", label: "Frecuentes" },
    ],
  },
  {
    key: "persuasiveness",
    label: "Persuasión",
    options: [
      { value: "baja", label: "Baja" },
      { value: "media", label: "Media" },
      { value: "alta", label: "Alta" },
    ],
  },
];
