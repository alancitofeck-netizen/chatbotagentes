import type { PublicMiniAppView } from "@/lib/miniApps/queries";
import { CONTROL_FINANCIERO_CSS, CONTROL_FINANCIERO_BODY_HTML, CONTROL_FINANCIERO_LOGIC_JS } from "./controlFinancieroTemplate";

/** Sirve el HTML/CSS/JS de "Top Apps, de ingresos y gastos" (Control
 * Financiero — Presupuesto Base Cero) tal cual — ver
 * controlFinancieroTemplate.ts para el detalle de qué cambia y qué no.
 * Server Component simple, mismo criterio que TestEmergenciaApp/
 * DiagnosticoSaludApp: sin interactividad React, toda la interacción es el
 * JS vanilla inyectado, sin Tailwind ni el sistema de paleta --ma-* (diseño
 * Fraunces/Hanken Grotesk/Space Grotesk autocontenido, propio de este
 * tipo). Los `<link>` de Google Fonts van acá (no en el HTML original)
 * porque Next.js los hoistea a `<head>` automáticamente al renderizarlos en
 * cualquier punto del árbol. */
export function ControlFinancieroApp({ app }: { app: PublicMiniAppView<"control_financiero_base_cero"> }) {
  const { brand } = app.config;

  const data = {
    slug: app.slug,
    brand: {
      advisorName: brand.advisorName,
      title: brand.title,
      subtitle: brand.subtitle,
      logoURL: app.branding.logoUrl || brand.logoURL,
      colorMarca: brand.colorMarca,
      monedaDefault: brand.monedaDefault,
      anio: brand.anio,
    },
  };

  // Escapa "<" para que ningún valor editable (título, subtítulo, etc.)
  // pueda cerrar el <script> antes de tiempo — mismo criterio que
  // TestEmergenciaApp/DiagnosticoSaludApp.
  const serializedData = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- regla pensada para _document.js del Pages Router; en App Router cargar la fuente por ruta (Server Component) es el patrón correcto cuando next/font no aplica (fuente variable propia de este Mini App). */}
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Hanken+Grotesk:wght@400;500;600;700;800&family=Space+Grotesk:wght@500;600;700&display=swap"
        rel="stylesheet"
      />
      <style dangerouslySetInnerHTML={{ __html: CONTROL_FINANCIERO_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: CONTROL_FINANCIERO_BODY_HTML }} />
      <script dangerouslySetInnerHTML={{ __html: `window.__CONTROL_FINANCIERO_DATA__=${serializedData};` }} />
      <script dangerouslySetInnerHTML={{ __html: CONTROL_FINANCIERO_LOGIC_JS }} />
    </>
  );
}
