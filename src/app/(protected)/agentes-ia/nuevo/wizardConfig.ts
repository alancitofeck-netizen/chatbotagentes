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

/** Los 3 tipos son reales y funcionales — cada uno define presets propios
 * (objetivos/tools por defecto/prompt) más abajo en este archivo. Ninguno
 * introduce un `module_key` nuevo (ver decisionEngine.ts:80 — `module_key`
 * se CALCULA desde la relación real del contacto, un valor inventado ahí
 * nunca sería elegido para responder ninguna conversación real): "tipo" es
 * un eje del wizard, ortogonal al módulo real (CRM/Referidos) que decide
 * StepIdentity más abajo. */
export const AGENT_TYPE_PRESETS: { key: AgentTypePreset; name: string; description: string; emoji: string }[] = [
  { key: "referrals", name: "Agente de Referidos", description: "Contacta y gestiona referidos del CRM.", emoji: "🤝" },
  { key: "citas", name: "Agente de Citas", description: "Ayuda a conseguir, coordinar y gestionar reuniones con los prospectos.", emoji: "📅" },
  { key: "seguimiento", name: "Agente de Seguimiento", description: "Recupera conversaciones sin respuesta y realiza seguimientos.", emoji: "🔄" },
];

/** Para "Agente de Referidos" el módulo real queda SIEMPRE fijo en
 * 'referrals' (no se muestra selector, mismo comportamiento de siempre).
 * Para Citas/Seguimiento el usuario elige la fuente real en el paso
 * Identidad — 'referrals' = whitelist real de asesoria_referrals sin
 * cambios; 'crm' = mismo comportamiento sin whitelist que ya tenían los
 * agentes CRM, nada nuevo que construir en seguridad. */
export const MODULE_OPTIONS: { key: WizardModuleKey; name: string; description: string }[] = [
  { key: "referrals", name: "Referidos", description: "Solo puede hablar con contactos autorizados por la lista de referidos del CRM." },
  { key: "crm", name: "CRM", description: "Conversa con los contactos y oportunidades de tu CRM general." },
];

/** "¿Cómo funcionará?" del paso Identidad — por tipo, no por módulo. */
export const HOW_IT_WORKS: Record<AgentTypePreset, string[]> = {
  referrals: [
    "Solo trabajará con contactos autorizados provenientes de asesoria_referrals.",
    "Podrá iniciar conversaciones por WhatsApp desde Growth Link.",
    "Mantendrá conversaciones naturales y calificará referidos.",
    "Podrá crear seguimientos y transferir al asesor cuando corresponda.",
  ],
  citas: [
    "Detectará intención de agendar y propondrá horarios disponibles.",
    "Consultará la disponibilidad real de la agenda antes de proponer nada.",
    "Podrá crear, reprogramar y cancelar citas.",
    "Notificará al asesor cuando la cita quede agendada.",
  ],
  seguimiento: [
    "Identificará conversaciones sin respuesta según las reglas configuradas.",
    "Programará reintentos (máximo 3 por contacto) — nunca envía sin un intento real programado.",
    "Cada seguimiento vencido sin respuesta se convierte en una tarea para el asesor.",
    "Se detiene automáticamente si el contacto responde o el asesor toma la conversación.",
  ],
};

export const FLOW_STEPS: Record<AgentTypePreset, string[]> = {
  referrals: ["Referido autorizado", "Agente IA", "Conversación calificada", "Reunión agendada"],
  citas: ["Contacto interesado", "Agente IA", "Horario propuesto", "Cita confirmada"],
  seguimiento: ["Conversación sin respuesta", "Agente IA", "Seguimiento programado", "Reactivación"],
};

/** Lista neutra por tipo — no persiste como columna propia. Alimenta la
 * plantilla determinística del prompt inicial (paso Cerebro). */
export const OBJECTIVE_OPTIONS: Record<AgentTypePreset, { key: string; label: string }[]> = {
  referrals: [
    { key: "iniciar_conversaciones", label: "Iniciar conversaciones" },
    { key: "generar_confianza", label: "Generar confianza" },
    { key: "calificar_contactos", label: "Calificar contactos" },
    { key: "conseguir_citas", label: "Conseguir citas" },
  ],
  citas: [
    { key: "detectar_intencion", label: "Detectar intención de agendar" },
    { key: "proponer_horarios", label: "Proponer horarios" },
    { key: "agendar", label: "Agendar" },
    { key: "confirmar", label: "Confirmar" },
    { key: "reprogramar", label: "Reprogramar" },
  ],
  seguimiento: [
    { key: "recuperar_conversaciones", label: "Recuperar conversaciones" },
    { key: "detectar_falta_respuesta", label: "Detectar falta de respuesta" },
    { key: "programar_seguimientos", label: "Programar seguimientos" },
    { key: "reactivar_oportunidades", label: "Reactivar oportunidades" },
  ],
};

/** Reglas de sistema: vienen pre-tildadas y no se pueden destildar dentro
 * del wizard (una vez creado el agente, la pestaña Personalidad ya permite
 * editar/borrar cualquier regla — ahí no hay distinción sistema/custom
 * porque `ai_agents.rules` es un text[] plano, no se cambió el schema). Se
 * mantienen por MÓDULO (la whitelist es una propiedad del módulo real, no
 * del tipo) — Citas/Seguimiento heredan las mismas según qué módulo elijan. */
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
 * "Crear tareas"/"Notificar al asesor"/"Confirmar cita" tampoco son tools
 * propias — las crea el cron de seguimientos, el propio
 * request_human_handoff, y la conversación natural del agente,
 * respectivamente — se describen como consecuencia, no como checkbox.
 * Filtro real de seguridad: qué tools EXISTEN como opción según el módulo
 * real (crm nunca ve update_referral/schedule_followup, sin importar el
 * tipo elegido). */
export const TOOL_GROUPS: Record<WizardModuleKey, ToolGroup[]> = {
  referrals: [
    { key: "crm", name: "CRM", toolKeys: ["update_referral", "schedule_followup", "search_contact", "query_crm_context", "create_opportunity"] },
    { key: "calendario", name: "Calendario", toolKeys: ["check_agenda_availability", "create_appointment", "update_appointment"] },
    { key: "asesor", name: "Asesor", toolKeys: ["request_human_handoff"] },
  ],
  crm: [
    { key: "crm", name: "CRM", toolKeys: ["search_contact", "query_crm_context", "create_opportunity", "run_automation"] },
    { key: "calendario", name: "Calendario", toolKeys: ["check_agenda_availability", "create_appointment", "update_appointment"] },
    { key: "asesor", name: "Equipo", toolKeys: ["request_human_handoff"] },
  ],
};

/** Preseleccionadas al entrar al paso Acciones — las tools más centrales de
 * cada TIPO (no del módulo), editable libremente por el usuario. Se
 * intersecta con TOOL_GROUPS[moduleKey] al aplicarse (ver StepActions/
 * AgentWizardShell) para que nunca se preseleccione una tool que ese
 * módulo no ofrece. */
export const DEFAULT_TOOL_KEYS: Record<AgentTypePreset, string[]> = {
  referrals: ["update_referral", "schedule_followup", "request_human_handoff"],
  citas: ["check_agenda_availability", "create_appointment", "update_appointment", "request_human_handoff"],
  seguimiento: ["schedule_followup", "request_human_handoff"],
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

/** Los pasos Fuente/Análisis dependen del MÓDULO real resuelto (whitelist,
 * Perfil del asesor), no del tipo — un Citas/Seguimiento sobre CRM los
 * saltea igual que un agente CRM genérico; sobre Referidos los tiene igual
 * que un Agente de Referidos. */
export function stepsForModule(moduleKey: WizardModuleKey): readonly WizardStep[] {
  return moduleKey === "referrals" ? WIZARD_STEPS_REFERRALS : WIZARD_STEPS_CRM;
}

const TYPE_INTRO: Record<AgentTypePreset, string> = {
  referrals: "Contactás y gestionás referidos del CRM.",
  citas: "Ayudás a conseguir, coordinar y gestionar reuniones con los prospectos.",
  seguimiento: "Recuperás conversaciones sin respuesta y hacés seguimiento comercial.",
};

/** Plantilla determinística — nunca llama a IA. "Mejorar con IA" (paso
 * Cerebro) es la única puerta a OpenRouter en todo el wizard, y solo se
 * activa con un click explícito. */
export function buildInitialPrompt(
  state: Pick<WizardState, "name" | "description" | "moduleKey" | "agentType" | "objectives" | "mainObjective">,
): string {
  const objectiveLabels = OBJECTIVE_OPTIONS[state.agentType].filter((o) => state.objectives.includes(o.key)).map((o) => o.label);
  const lines = [
    `Sos "${state.name || "el agente"}", un asistente de IA por WhatsApp de Growth Link. ${TYPE_INTRO[state.agentType]}`,
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
