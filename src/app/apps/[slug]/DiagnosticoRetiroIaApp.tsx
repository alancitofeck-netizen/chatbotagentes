import type { PublicMiniAppView } from "@/lib/miniApps/queries";
import { DIAGNOSTICO_RETIRO_IA_CSS, DIAGNOSTICO_RETIRO_IA_BODY_HTML, DIAGNOSTICO_RETIRO_IA_LOGIC_JS } from "./diagnosticoRetiroIaTemplate";

/** Sirve el HTML/CSS/JS de "Diagnóstico de Retiro con IA" tal cual — ver
 * diagnosticoRetiroIaTemplate.ts para el detalle de qué cambia y qué no.
 * Server Component simple, mismo criterio que AhorroFiscalApp: sin
 * interactividad React, toda la interacción es el JS vanilla inyectado, y
 * sin Tailwind ni el sistema de paleta --ma-* (diseño navy/dorado
 * autocontenido, propio de este tipo). Los `<link>` de Google Fonts van acá
 * (no en el HTML original) porque Next.js los hoistea a `<head>`
 * automáticamente al renderizarlos en cualquier punto del árbol. */
export function DiagnosticoRetiroIaApp({ app }: { app: PublicMiniAppView<"diagnostico_retiro_ia"> }) {
  const { brand } = app.config;

  const data = {
    slug: app.slug,
    brand: {
      agente: brand.agente,
      titulo: brand.titulo,
      whatsapp: brand.whatsapp,
      photoURL: brand.photoURL,
      agenteID: brand.agenteID,
      colorMarca: brand.colorMarca,
      calendlyURL: brand.calendlyURL,
      avisoPrivacidadURL: brand.avisoPrivacidadURL,
      webhookURL: brand.webhookURL,
      urlCalculadoraRetiro: brand.urlCalculadoraRetiro,
      urlSaludFinanciera: brand.urlSaludFinanciera,
    },
  };

  // Escapa "<" para que ningún valor editable (nombre, título, etc.) pueda
  // cerrar el <script> antes de tiempo — mismo criterio que
  // AhorroFiscalApp/MetaUniversitariaApp.
  const serializedData = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- regla pensada para _document.js del Pages Router; en App Router cargar la fuente por ruta (Server Component) es el patrón correcto cuando next/font no aplica (fuente variable con ejes ital/opsz que solo este Mini App usa). */}
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600;700&display=swap"
        rel="stylesheet"
      />
      <style dangerouslySetInnerHTML={{ __html: DIAGNOSTICO_RETIRO_IA_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: DIAGNOSTICO_RETIRO_IA_BODY_HTML }} />
      <script dangerouslySetInnerHTML={{ __html: `window.__DIAGNOSTICO_RETIRO_IA_DATA__=${serializedData};` }} />
      <script dangerouslySetInnerHTML={{ __html: DIAGNOSTICO_RETIRO_IA_LOGIC_JS }} />
    </>
  );
}
