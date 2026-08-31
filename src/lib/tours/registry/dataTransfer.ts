import type { TourConfig } from "../types";

/** Verificado contra ImportDropzone.tsx (accept=".csv,.xlsx" — solo esos dos
 * formatos, no se inventan otros), ExportCenter.tsx y SyncCenter.tsx. El
 * paso de sincronización solo apunta al botón "Conectar" real (Google
 * Sheets/Drive, con OAuth real) — Outlook/Dropbox/OneDrive son
 * "Próximamente" en el código y no tienen tour. */
export const dataTransferIntroTour: TourConfig = {
  key: "data-transfer-intro",
  moduleKey: "data_transfer",
  title: "Importar / Exportar",
  steps: [
    {
      target: '[data-tour="data-transfer.dropzone"]',
      title: "📥 Traé tu información a Growth Link",
      description: "Subí un archivo CSV o Excel — clientes, prospectos, pólizas, cobros, eventos o tareas.",
      placement: "right",
    },
    {
      target: '[data-tour="data-transfer.export-card"]',
      title: "📤 Llevate tus datos cuando quieras",
      description: "Cada entidad se puede exportar en CSV o Excel (algunas también en PDF).",
      placement: "left",
    },
    {
      target: '[data-tour="data-transfer.sync-connect"]',
      title: "Sincronización automática",
      description: "Conectá Google Sheets o Drive para que las exportaciones se guarden solas.",
      placement: "left",
    },
  ],
};

export const dataTransferTours: TourConfig[] = [dataTransferIntroTour];
