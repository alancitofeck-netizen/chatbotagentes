import type { TourConfig } from "../types";

/** Verificado contra finanzas/FinanzasShell.tsx (data-tour="finance.*"). Solo pasos visibles en
 * cualquier tamaño de pantalla (los botones "Nuevo gasto/cobro" de escritorio son un FAB en
 * celular). */
export const collectionsIntroTour: TourConfig = {
  key: "collections-intro",
  moduleKey: "collections",
  title: "Finanzas",
  steps: [
    {
      target: '[data-tour="finance.tabs"]',
      title: "💰 Tus finanzas en un solo lugar",
      description: "Gastos con su medio de pago, el calendario de lo que cobrás y pagás, tus cobros (pólizas, asesorías y ventas) y el resumen del mes.",
      placement: "bottom",
    },
    {
      target: '[data-tour="finance.currency"]',
      title: "Moneda de los totales",
      description: "Elegí en qué moneda ver los totales y ajustá el tipo de cambio. Cada movimiento conserva su moneda original.",
      placement: "bottom",
    },
  ],
};

export const collectionsTours: TourConfig[] = [collectionsIntroTour];
