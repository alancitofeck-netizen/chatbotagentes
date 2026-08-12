import type { PublicMiniAppView } from "@/lib/miniApps/queries";
import { CALCULADORA_INGRESOS_CSS, CALCULADORA_INGRESOS_BODY_HTML, CALCULADORA_INGRESOS_LOGIC_JS } from "./calculadoraIngresosTemplate";

/** Sirve el HTML/CSS/JS de "Calculadora de Capacidad de Generar Ingresos"
 * tal cual — ver calculadoraIngresosTemplate.ts para el detalle de qué
 * cambia y qué no. Server Component simple, mismo criterio que
 * DiagnosticoSolidezApp: sin interactividad React, toda la interacción es
 * el JS vanilla inyectado, y sin Tailwind ni el sistema de paleta --ma-*
 * (diseño Fraunces/Inter/IBM Plex Mono autocontenido, propio de este tipo).
 * Los `<link>` de Google Fonts van acá (no en el HTML original) porque
 * Next.js los hoistea a `<head>` automáticamente al renderizarlos en
 * cualquier punto del árbol — la fuente nunca se cargaba desde el layout
 * raíz (que solo trae Geist). */
export function CalculadoraIngresosApp({ app }: { app: PublicMiniAppView<"calculadora_capacidad_ingresos"> }) {
  const { brand } = app.config;

  const data = {
    slug: app.slug,
    brand: {
      advisorName: brand.advisorName,
      companyName: brand.companyName,
      whatsapp: brand.whatsapp,
      calendly: brand.calendly,
      logo: app.branding.logoUrl || brand.logoURL,
      webhookURL: brand.webhookURL,
    },
  };

  // Escapa "<" para que ningún valor editable (nombre, etc.) pueda cerrar el
  // <script> antes de tiempo — mismo criterio que DiagnosticoSolidezApp.
  const serializedData = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- regla pensada para _document.js del Pages Router; en App Router cargar la fuente por ruta (Server Component) es el patrón correcto cuando next/font no aplica (fuente variable con ejes ital/opsz que solo este Mini App usa). */}
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap"
        rel="stylesheet"
      />
      <style dangerouslySetInnerHTML={{ __html: CALCULADORA_INGRESOS_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: CALCULADORA_INGRESOS_BODY_HTML }} />
      <script dangerouslySetInnerHTML={{ __html: `window.__CALCULADORA_INGRESOS_DATA__=${serializedData};` }} />
      <script dangerouslySetInnerHTML={{ __html: CALCULADORA_INGRESOS_LOGIC_JS }} />
    </>
  );
}
