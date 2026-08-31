import type { TourConfig } from "../types";

/** Un solo paso real, a propósito — verificado contra
 * PolicyExtractionShell.tsx: es un flujo de un solo documento (subir →
 * revisar → confirmar), y el panel de revisión/confirmación no existe en
 * el DOM hasta que el usuario sube un PDF real. Apuntar el tour a ese botón
 * lo dejaría esperando ~6s en vano en cada auto-inicio. La zona dropzone es
 * el único elemento real siempre presente — su descripción cubre el flujo
 * completo (PDF → IA analiza → detecta datos → los organiza → los guarda
 * en Pólizas) en texto, ya que no hay más elementos reales para anclar
 * pasos intermedios sin que el usuario ya haya subido algo. */
export const extractionIntroTour: TourConfig = {
  key: "extraction-intro",
  moduleKey: "policy_extraction",
  title: "Extracción de pólizas con IA",
  steps: [
    {
      target: '[data-tour="extraction.dropzone"]',
      title: "🤖 La IA puede extraer información automáticamente",
      description: "Subí el PDF de una póliza acá. La IA lo analiza, detecta los datos, los organiza y — cuando los confirmes — los guarda directo en Pólizas.",
      placement: "right",
    },
  ],
};

export const extractionTours: TourConfig[] = [extractionIntroTour];
