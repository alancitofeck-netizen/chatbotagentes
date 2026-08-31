import type { TourConfig } from "../types";

/** Verificado contra AseguradorasShell.tsx/ProviderCard.tsx — cada tarjeta
 * es un botón que abre "Conectar" (si no está conectada) o "Gestionar" (si
 * ya lo está); el tour solo apunta al concepto de la tarjeta, sin asumir
 * cuál de los dos modales se abre. */
export const providersIntroTour: TourConfig = {
  key: "providers-intro",
  moduleKey: "insurance_providers",
  title: "Conexión con Aseguradoras",
  steps: [
    {
      target: '[data-tour="providers.card"]',
      title: "🏢 Conectá cada aseguradora",
      description: "Tocá una tarjeta para conectarla — por archivo (CSV/Excel), portal, o (próximamente) API. Una vez conectada, tu cartera se sincroniza sola.",
      action: "click",
      placement: "bottom",
    },
  ],
};

export const providersTours: TourConfig[] = [providersIntroTour];
