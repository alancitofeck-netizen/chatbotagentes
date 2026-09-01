import type { PublicMiniAppView } from "@/lib/miniApps/queries";
import { getPublicContentCalendarData, type ContentCalendarData, type ContentCalendarWeek } from "@/lib/miniApps/contentCalendar";
import { CONTENT_CALENDAR_CSS, CONTENT_CALENDAR_BODY_HTML, CONTENT_CALENDAR_LOGIC_JS } from "./contentCalendarTemplate";

/** Sirve el HTML/CSS/JS del "Cronograma de Contenido — Sujey Urías" tal
 * cual el archivo adjunto por el usuario — ver contentCalendarTemplate.ts
 * para el detalle de qué cambia (nada visual) y qué no. Mismo patrón que
 * DiagnosticoFinancieroApp.tsx: Server Component simple, toda la
 * interacción (tabs) es el JS vanilla inyectado. Solo lectura — la edición
 * real vive en el panel interno protegido (/mini-apps/[id]). */

function toFlatWeeks(weeks: ContentCalendarWeek[], kind: "feed" | "historias") {
  return weeks.map((w) => ({
    semana: w.label,
    dias: w.days.map((d) =>
      kind === "feed"
        ? {
            fecha: d.dateLabel,
            piezas: d.pieces.map((p) => ({ tipo: p.tipo, formato: p.formato, funcion: p.funcion, hora: p.hora, idea: p.idea, status: p.status })),
          }
        : {
            fecha: d.dateLabel,
            tipo: d.stories[0]?.tipo ?? "",
            stories: d.stories.map((s) => s.text),
          },
    ),
  }));
}

function buildTemplateData(data: ContentCalendarData) {
  return {
    feedData: toFlatWeeks(data.feedWeeks, "feed"),
    historiasData: toFlatWeeks(data.historiaWeeks, "historias"),
    referencias: data.references.map((r) => ({
      creador: r.creador ?? "",
      url: r.url ?? "",
      producto: r.producto ?? "",
      formato: r.formato ?? "",
      vistas: r.vistas ?? "",
      comentarios: r.comentarios ?? "",
      hook: r.hook ?? "",
    })),
  };
}

export async function ContentCalendarApp({ app }: { app: PublicMiniAppView<"content_calendar"> }) {
  const data = await getPublicContentCalendarData(app.id);
  // Mismo escapado de "<" que el resto de plantillas (DiagnosticoFinancieroApp.tsx)
  // para que ningún hook/guion editable pueda cerrar el <script> antes de tiempo.
  const serializedData = JSON.stringify(buildTemplateData(data)).replace(/</g, "\\u003c");

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- mismo criterio que DiagnosticoSolidezApp.tsx: fuente cargada por ruta, no next/font, para un Mini App con sistema tipográfico autocontenido. */}
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <style dangerouslySetInnerHTML={{ __html: CONTENT_CALENDAR_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: CONTENT_CALENDAR_BODY_HTML }} />
      <script dangerouslySetInnerHTML={{ __html: `window.__CONTENT_CALENDAR_DATA__=${serializedData};` }} />
      <script dangerouslySetInnerHTML={{ __html: CONTENT_CALENDAR_LOGIC_JS }} />
    </>
  );
}
