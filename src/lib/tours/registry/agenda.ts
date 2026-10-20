import type { TourConfig } from "../types";

/** Explicativo — verificado contra AgendaShell.tsx. Las citas llegan solas desde una hoja de
 * Google Sheets conectada, pero también se pueden cargar a mano con "Nueva cita"/"Editar" (ver
 * AgendaRecordForm.tsx) — a diferencia de la versión anterior de este tour, acá el botón sí abre
 * un formulario real. */
export const agendaIntroTour: TourConfig = {
  key: "agenda-intro",
  moduleKey: "agenda",
  title: "Tu Agenda",
  steps: [
    {
      target: '[data-tour="agenda.range-switcher"]',
      title: "📆 Elegí el día",
      description: "Tocá un día de la semana para ver sus citas — el puntito marca los días que ya tienen alguna cargada.",
      placement: "bottom",
    },
    {
      target: '[data-tour="agenda.filters-button"]',
      title: "Buscá y filtrá por setter o estado",
      description: "Útil cuando gestionás la agenda de todo tu equipo.",
      placement: "bottom",
    },
    {
      target: '[data-tour="agenda.new-cita-button"]',
      title: "Cargá una cita a mano",
      description: "Además de las que llegan solas desde tu hoja, acá podés agendar un lead manualmente.",
      placement: "left",
    },
    {
      target: '[data-tour="agenda.sheet-status"]',
      title: "🔗 Las citas también se sincronizan solas",
      description: "Cargá o actualizá la cita en tu hoja de Google Sheets conectada y tocá Sincronizar ahora — en segundos aparece acá.",
      placement: "bottom",
    },
  ],
};

export const agendaTours: TourConfig[] = [agendaIntroTour];
