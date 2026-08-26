import type { AgentPersonality } from "@/lib/ai-agents/queries";

export type WizardModuleKey = "crm" | "referrals";
export type AgentTypePreset = "referrals" | "citas" | "seguimiento";

export const DEFAULT_PERSONALITY: AgentPersonality = {
  formality: "media",
  warmth: "alta",
  directness: "equilibrado",
  emojiUsage: "bajo",
  messageLength: "cortos",
  questioningStyle: "frecuente",
  persuasiveness: "media",
};

export interface WizardState {
  moduleKey: WizardModuleKey;
  agentType: AgentTypePreset;
  name: string;
  description: string;
  objectives: string[];
  mainObjective: string;
  systemPrompt: string;
  promptTouched: boolean;
  personality: AgentPersonality;
  customRules: string[];
  toolIds: string[];
  analysisAspects: string[];
  analysisPeriod: "30" | "90" | "180" | "all";
}

export function buildDefaultWizardState(): WizardState {
  return {
    moduleKey: "referrals",
    agentType: "referrals",
    name: "",
    description: "",
    objectives: [],
    mainObjective: "",
    systemPrompt: "",
    promptTouched: false,
    personality: DEFAULT_PERSONALITY,
    customRules: [],
    toolIds: [],
    analysisAspects: [],
    analysisPeriod: "90",
  };
}

/** Solo tiene 3 tarjetas visuales porque el mockup de referencia las pide
 * así — "Agente de Citas"/"Agente de Seguimiento" no tienen un moduleKey ni
 * comportamiento propio distinto en el motor (agentRuntime.ts/toolRouter.ts
 * no distinguen "tipos" dentro de module_key='referrals'), así que solo
 * "Agente de Referidos" queda habilitado esta pasada — las otras dos son
 * roadmap visible, no funcionalidad fabricada. */
export const AGENT_TYPE_PRESETS: { key: AgentTypePreset; name: string; description: string; emoji: string; enabled: boolean }[] = [
  { key: "referrals", name: "Agente de Referidos", description: "Contacta y gestiona referidos del CRM.", emoji: "🤖", enabled: true },
  { key: "citas", name: "Agente de Citas", description: "Ayuda a conseguir y gestionar reuniones.", emoji: "📅", enabled: false },
  { key: "seguimiento", name: "Agente de Seguimiento", description: "Recupera conversaciones sin respuesta.", emoji: "🔄", enabled: false },
];

export const MODULE_OPTIONS: { key: WizardModuleKey; name: string; description: string }[] = [
  { key: "referrals", name: "Referidos", description: "Solo puede hablar con contactos autorizados por la lista de referidos del CRM." },
  { key: "crm", name: "CRM", description: "Conversa con los contactos y oportunidades de tu CRM general." },
];

/** Lista neutra — no persiste como columna propia. Alimenta la plantilla
 * determinística del prompt inicial (paso Cerebro) y qué tools/reglas
 * vienen pre-tildadas más adelante. */
export const OBJECTIVE_OPTIONS: { key: string; label: string }[] = [
  { key: "iniciar_conversaciones", label: "Iniciar conversaciones" },
  { key: "generar_confianza", label: "Generar confianza" },
  { key: "detectar_necesidades", label: "Detectar necesidades" },
  { key: "calificar_contactos", label: "Calificar contactos" },
  { key: "resolver_objeciones", label: "Resolver objeciones" },
  { key: "conseguir_citas", label: "Conseguir citas" },
  { key: "crear_seguimientos", label: "Crear seguimientos" },
  { key: "transferir_asesor", label: "Transferir al asesor" },
];

/** Reglas de sistema: vienen pre-tildadas y no se pueden destildar dentro
 * del wizard (una vez creado el agente, la pestaña Personalidad ya permite
 * editar/borrar cualquier regla — ahí no hay distinción sistema/custom
 * porque `ai_agents.rules` es un text[] plano, no se cambió el schema). */
export const SYSTEM_RULES: Record<WizardModuleKey, string[]> = {
  referrals: [
    "Solo trabajar con contactos autorizados por la lista de referidos.",
    "Nunca inventar información.",
    "Nunca inventar precios.",
    "No prometer resultados.",
    "No insistir indefinidamente.",
    "No repetir preguntas ya respondidas.",
    "Transferir al asesor cuando sea necesario.",
    "Pausar cuando el asesor tome la conversación.",
  ],
  crm: [
    "Nunca inventar información.",
    "Nunca inventar precios.",
    "No prometer resultados.",
    "No insistir indefinidamente.",
    "No repetir preguntas ya respondidas.",
    "Transferir al asesor cuando sea necesario.",
    "Pausar cuando el asesor tome la conversación.",
  ],
};

export interface ToolGroup {
  key: string;
  name: string;
  /** Claves reales de la tabla `tools` — nunca se inventa una tool nueva acá. */
  toolKeys: string[];
}

/** "WhatsApp" no aparece como grupo de checkboxes — no son tools
 * independientes, son la capacidad base de cualquier agente activo con
 * canal whatsapp (se explica como texto fijo en el paso, ver StepActions).
 * "Crear tareas"/"Notificar al asesor" tampoco son tools propias — las crea
 * el cron de seguimientos y el propio request_human_handoff, respectivamente
 * (ver comentario en el plan) — se describen como consecuencia, no como
 * checkbox. */
export const TOOL_GROUPS: Record<WizardModuleKey, ToolGroup[]> = {
  referrals: [
    { key: "crm", name: "CRM", toolKeys: ["update_referral", "schedule_followup", "search_contact", "query_crm_context", "create_opportunity"] },
    { key: "calendario", name: "Calendario", toolKeys: ["check_agenda_availability", "create_appointment"] },
    { key: "asesor", name: "Asesor", toolKeys: ["request_human_handoff"] },
  ],
  crm: [
    { key: "crm", name: "CRM", toolKeys: ["search_contact", "query_crm_context", "create_opportunity", "run_automation"] },
    { key: "calendario", name: "Calendario", toolKeys: ["check_agenda_availability", "create_appointment"] },
    { key: "asesor", name: "Equipo", toolKeys: ["request_human_handoff"] },
  ],
};

/** Preseleccionadas al entrar al paso Acciones — las tools más centrales de
 * cada módulo, editable libremente por el usuario antes de crear el agente. */
export const DEFAULT_TOOL_KEYS: Record<WizardModuleKey, string[]> = {
  referrals: ["update_referral", "schedule_followup", "request_human_handoff"],
  crm: ["search_contact", "query_crm_context", "request_human_handoff"],
};

export const ANALYSIS_ASPECT_OPTIONS: { key: string; label: string }[] = [
  { key: "estilo_comunicacion", label: "Estilo de comunicación" },
  { key: "proceso_comercial", label: "Proceso comercial" },
  { key: "manejo_objeciones", label: "Manejo de objeciones" },
  { key: "seguimientos", label: "Seguimientos" },
  { key: "conversaciones_exitosas", label: "Conversaciones exitosas" },
];

export const WIZARD_STEPS_REFERRALS = ["identidad", "objetivo", "cerebro", "acciones", "reglas", "fuente", "analisis", "resumen"] as const;
export const WIZARD_STEPS_CRM = ["identidad", "objetivo", "cerebro", "acciones", "reglas", "resumen"] as const;
export type WizardStep = (typeof WIZARD_STEPS_REFERRALS)[number];

export const STEP_LABELS: Record<WizardStep, string> = {
  identidad: "Identidad",
  objetivo: "Objetivo",
  cerebro: "Cerebro",
  acciones: "Acciones",
  reglas: "Reglas",
  fuente: "Fuente",
  analisis: "Análisis",
  resumen: "Resumen",
};

export function stepsForModule(moduleKey: WizardModuleKey): readonly WizardStep[] {
  return moduleKey === "referrals" ? WIZARD_STEPS_REFERRALS : WIZARD_STEPS_CRM;
}

/** Plantilla determinística — nunca llama a IA. "Mejorar con IA" (paso
 * Cerebro) es la única puerta a OpenRouter en todo el wizard, y solo se
 * activa con un click explícito. */
export function buildInitialPrompt(state: Pick<WizardState, "name" | "description" | "moduleKey" | "objectives" | "mainObjective">): string {
  const objectiveLabels = OBJECTIVE_OPTIONS.filter((o) => state.objectives.includes(o.key)).map((o) => o.label);
  const lines = [
    `Sos "${state.name || "el agente"}", un asistente de IA por WhatsApp de Growth Link.`,
    state.description ? `Tu función: ${state.description}` : null,
    state.moduleKey === "referrals"
      ? "Solo podés conversar con contactos autorizados por la lista de referidos del CRM."
      : "Conversás con los contactos y oportunidades del CRM del workspace.",
    state.mainObjective ? `Tu objetivo principal es: ${state.mainObjective}` : null,
    objectiveLabels.length ? `También buscás: ${objectiveLabels.join(", ")}.` : null,
    "Respondé siempre en español, de forma natural y humana.",
  ].filter((l): l is string => Boolean(l));
  return lines.join("\n\n");
}
