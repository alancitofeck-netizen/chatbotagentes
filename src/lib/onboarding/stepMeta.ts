import type { OnboardingStepKey } from "./types";

export interface StepMeta {
  label: string;
  description: string;
  ctaLabel: string;
  href: string;
}

/** Compartido entre WelcomeOnboardingModal.tsx y LearningProgress.tsx —
 * antes vivía duplicado solo en el modal de bienvenida. */
export const STEP_META: Record<OnboardingStepKey, StepMeta> = {
  profile: { label: "Perfil", description: "Completá tu nombre y foto para que tu equipo te reconozca.", ctaLabel: "Ir a mi perfil", href: "/profile" },
  whatsapp: { label: "WhatsApp", description: "Conectá WhatsApp para recibir y gestionar tus conversaciones directamente desde Growth Link.", ctaLabel: "Conectar WhatsApp", href: "/profile?tab=integrations" },
  manychat: { label: "Instagram / ManyChat", description: "Recibí y analizá los leads que ManyChat gestiona en tu Instagram.", ctaLabel: "Conectar ManyChat", href: "/manychat?tab=configuracion" },
  calendar: { label: "Calendario", description: "Sincronizá Google Calendar para que tus eventos se organicen solos.", ctaLabel: "Conectar Calendario", href: "/profile?tab=integrations" },
  crm: { label: "CRM", description: "Acá vas a gestionar tus leads y oportunidades — vas a aprender a crear el primero apenas entres.", ctaLabel: "Ir al CRM", href: "/crm" },
  automations: { label: "Automatizaciones", description: "Hacé que Growth Link trabaje automáticamente por vos.", ctaLabel: "Ir a Automatizaciones", href: "/automatizaciones" },
};

/** Solo estos 3 pasos del checklist tienen un Product Tour real cuya
 * página coincide con `STEP_META[step].href` — "calendar" queda afuera a
 * propósito: su href real es Perfil→Integraciones (conectar Google
 * Calendar), pero el tour "calendar-intro" vive en /calendar; lanzarlo ahí
 * después de navegar a Perfil fallaría en silencio (el target nunca
 * aparece). El tour de Calendario sigue siendo su propia fila en "Tu
 * aprendizaje" (viene de ALL_TOURS), solo que no está atado a este paso
 * del checklist. */
export const STEP_TOUR_KEY: Partial<Record<OnboardingStepKey, string>> = {
  manychat: "manychat-intro",
  crm: "crm-create-lead",
  automations: "automations-intro",
};
