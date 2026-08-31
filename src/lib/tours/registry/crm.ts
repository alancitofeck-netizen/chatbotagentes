import type { TourConfig } from "../types";

/** Pasos verificados contra el código real de src/app/(protected)/crm/BoardActionBar.tsx
 * (botón "Nuevo lead") y LeadFormSheet.tsx (campos Nombre/Teléfono/Fuente del
 * lead/botón Guardar) — no inventa ningún campo que no exista hoy. */
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
      description: "Elegí o escribí su origen (ej. LinkedIn, referido, web).",
      placement: "bottom",
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
