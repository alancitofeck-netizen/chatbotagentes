import type { TourConfig } from "../types";

/** Pasos verificados contra el código real de src/app/(protected)/crm/BoardActionBar.tsx
 * (botón "Nuevo lead") y LeadWizardSheet.tsx (wizard de 3 pasos: Contacto →
 * Oportunidad → Asignación) — no inventa ningún campo que no exista hoy.
 * Los pasos "Continuar" (`crm.wizard-step1-continue`/`-step2-continue`) son
 * necesarios porque el botón "Crear lead" real vive en el paso 3, no en la
 * misma pantalla que Nombre/Teléfono/Fuente (antes de este wizard, todo
 * vivía en un único formulario y no hacía falta avanzar de pantalla). */
export const crmCreateLeadTour: TourConfig = {
  key: "crm-create-lead",
  moduleKey: "crm",
  title: "Crear tu primer lead",
  steps: [
    {
      target: '[data-tour="crm.new-lead-button"]',
      title: "👤 Empecemos por crear tu primer lead",
      description: "Acá vas a cargar la información de tus prospectos.",
      action: "click",
    },
    {
      target: '[data-tour="crm.lead-name-input"]',
      title: "Perfecto 👏",
      description: "Ahora ingresá el nombre del prospecto.",
      placement: "bottom",
    },
    {
      target: '[data-tour="crm.lead-phone-input"]',
      title: "Excelente",
      description: "Ahora agregá su WhatsApp.",
      placement: "bottom",
    },
    {
      target: '[data-tour="crm.lead-source-input"]',
      title: "¿De dónde llegó este lead?",
      description: "Elegí de dónde llegó (ej. WhatsApp, Instagram, referido).",
      placement: "bottom",
    },
    {
      target: '[data-tour="crm.wizard-step1-continue"]',
      title: "Vamos al siguiente paso",
      description: "Ahora cargamos los datos de la oportunidad.",
      action: "click",
      placement: "top",
    },
    {
      target: '[data-tour="crm.wizard-step2-continue"]',
      title: "Último paso",
      description: "Asigná un agente y etiquetas si querés.",
      action: "click",
      placement: "top",
    },
    {
      target: '[data-tour="crm.lead-save-button"]',
      title: "Perfecto",
      description: "Guardemos el lead.",
      action: "click",
      placement: "top",
    },
  ],
  completionTitle: "🎉 ¡Excelente!",
  completionDescription: "Acabás de crear tu primer lead en Growth Link.",
};

export const crmTours: TourConfig[] = [crmCreateLeadTour];
