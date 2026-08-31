import type { TourConfig } from "../types";

/** Verificado contra ClientesListShell.tsx/ClientCard.tsx. Este módulo es
 * solo para owner/admin del workspace de agencia (gate real en
 * asesores/layout.tsx vía getAgencyWorkspaceAccessForCurrentUser) — si el
 * usuario no tiene ese acceso, ningún elemento de acá se renderiza y el
 * tour nunca se auto-inicia (useAutoStartTour vive dentro de
 * ClientesListShell, que ni siquiera se monta sin el gate). */
export const advisorsAdminIntroTour: TourConfig = {
  key: "advisors-admin-intro",
  moduleKey: "asesores",
  title: "Asesores",
  steps: [
    {
      target: '[data-tour="advisors-admin.new-button"]',
      title: "👥 Administrá los asesores de tu agencia",
      description: "Desde acá podés dar de alta un asesor nuevo.",
      placement: "bottom",
    },
    {
      target: '[data-tour="advisors-admin.filters"]',
      title: "Buscá y filtrá",
      description: "Por estado o Account Manager — las tarjetas de arriba también funcionan como filtro rápido.",
      placement: "bottom",
    },
    {
      target: '[data-tour="advisors-admin.open-card"]',
      title: "Abrí un asesor",
      description: "Para ver su perfil, actividad, y las acciones que tu rol permite.",
      action: "click",
      placement: "top",
    },
  ],
};

export const advisorsAdminTours: TourConfig[] = [advisorsAdminIntroTour];
