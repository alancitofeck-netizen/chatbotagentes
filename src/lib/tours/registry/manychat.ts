import type { TourConfig } from "../types";

/** Verificado contra ManychatShell.tsx/ManyChatConnectionCard.tsx. Recorre
 * de la pestaña por defecto ("Resumen") a "Configuración" con un click real
 * (el motor espera a que exista el próximo target, sin importar el cambio
 * de contenido de tab) — nunca controla el flujo de ManyChat, solo señala
 * dónde generar/copiar el secreto real que ya existe hoy. */
export const manychatIntroTour: TourConfig = {
  key: "manychat-intro",
  moduleKey: "manychat",
  title: "ManyChat",
  steps: [
    {
      target: '[data-tour="manychat.tabs"]',
      title: "📊 Resumen, Leads, Conversaciones, Contenido, Analytics y Configuración",
      description: "GrowthLink recibe y analiza la actividad de tus leads de Instagram — nunca controla el flujo de ManyChat ni responde en tu lugar.",
      placement: "bottom",
    },
    {
      target: '[data-tour="manychat.tabs.configuracion"]',
      title: "Conectá tu cuenta",
      description: "Vamos a Configuración para ver cómo se conecta.",
      action: "click",
      placement: "bottom",
    },
    {
      target: '[data-tour="manychat.generate-secret"]',
      title: "🔗 Generá tu secreto",
      description: "Con esto y la URL de arriba, configurás el paso External Request en tu flujo de ManyChat — el resto es automático.",
      placement: "top",
    },
  ],
};

export const manychatTours: TourConfig[] = [manychatIntroTour];
