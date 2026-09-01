import type { TourConfig } from "../types";

/** Verificado contra ConversationList.tsx/ConversationThread.tsx. El
 * selector de Modo (IA/Humano/Híbrido) del panel de contacto queda afuera a
 * propósito: ese panel se renderiza dos veces en el DOM (versión de
 * escritorio siempre montada + una segunda instancia dentro de un Sheet
 * mobile, solo tras tocar "Detalles") — cubrir eso bien requeriría un paso
 * extra específico para mobile, fuera de alcance de esta pasada. El motor
 * (waitForElement) ya filtra por visibilidad real, así que el resto de los
 * pasos acá funciona igual en desktop y mobile sin duplicar config. */
export const inboxIntroTour: TourConfig = {
  key: "inbox-intro",
  moduleKey: "inbox",
  title: "Tu Inbox",
  steps: [
    {
      target: '[data-tour="inbox.search"]',
      title: "💬 Acá gestionás todas tus conversaciones",
      description: "Buscá por contacto o empresa.",
      placement: "bottom",
    },
    {
      target: '[data-tour="inbox.open-conversation"]',
      title: "Abrí una conversación",
      description: "Tocá cualquier conversación para ver el historial completo.",
      action: "click",
      placement: "right",
    },
    {
      target: '[data-tour="inbox.composer"]',
      title: "Respondé desde acá",
      description: "Escribí tu mensaje y presioná Enter para enviarlo.",
      placement: "top",
    },
  ],
};

export const inboxTours: TourConfig[] = [inboxIntroTour];
