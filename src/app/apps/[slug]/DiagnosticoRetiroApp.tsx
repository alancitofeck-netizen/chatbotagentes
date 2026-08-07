import type { PublicMiniAppView } from "@/lib/miniApps/queries";
import { DIAGNOSTICO_RETIRO_CSS, DIAGNOSTICO_RETIRO_BODY_HTML, DIAGNOSTICO_RETIRO_LOGIC_JS } from "./diagnosticoRetiroTemplate";

/** Sirve el HTML/CSS/JS de "Diagnóstico Financiero - Retiro" tal cual — ver
 * diagnosticoRetiroTemplate.ts para el detalle de qué cambia y qué no.
 * Server Component simple, mismo criterio que DiagnosticoFinancieroApp: sin
 * interactividad React, toda la interacción es el JS vanilla inyectado, y
 * sin Tailwind ni el sistema de paleta --ma-* (diseño navy/dorado
 * autocontenido, propio de este tipo). */
export function DiagnosticoRetiroApp({ app }: { app: PublicMiniAppView<"diagnostico_financiero_retiro"> }) {
  const { asesor, referido, producto, textos, areaLabels, questions, umbral1, umbral2, perfiles, recoPool, themePool } = app.config;

  const data = {
    slug: app.slug,
    asesor: {
      nombre: asesor.nombre,
      marca: asesor.marca,
      lema: asesor.lema,
      whatsapp: asesor.whatsapp,
      webhookUrl: asesor.webhookUrl,
      logoUrl: app.branding.logoUrl ?? "",
    },
    referido,
    producto,
    textos,
    areaLabels,
    questions,
    umbral1,
    umbral2,
    perfiles,
    recoPool,
    themePool,
  };

  // Escapa "<" para que ningún valor editable (título, preguntas, textos de
  // recomendación, etc.) pueda cerrar el <script> antes de tiempo —
  // mismo criterio que DiagnosticoFinancieroApp.
  const serializedData = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DIAGNOSTICO_RETIRO_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: DIAGNOSTICO_RETIRO_BODY_HTML }} />
      <script dangerouslySetInnerHTML={{ __html: `window.__DIAGNOSTICO_RETIRO_DATA__=${serializedData};` }} />
      <script dangerouslySetInnerHTML={{ __html: DIAGNOSTICO_RETIRO_LOGIC_JS }} />
    </>
  );
}
