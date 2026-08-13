import type { PublicMiniAppView } from "@/lib/miniApps/queries";
import { AHORRO_FISCAL_CSS, AHORRO_FISCAL_BODY_HTML, AHORRO_FISCAL_LOGIC_JS } from "./ahorroFiscalTemplate";

/** Sirve el HTML/CSS/JS de "Calculadora de Ahorro Fiscal" tal cual — ver
 * ahorroFiscalTemplate.ts para el detalle de qué cambia y qué no. Server
 * Component simple, mismo criterio que MetaUniversitariaApp: sin
 * interactividad React, toda la interacción es el JS vanilla inyectado, y
 * sin Tailwind ni el sistema de paleta --ma-* (diseño Fraunces/Hanken
 * Grotesk autocontenido, propio de este tipo). Los `<link>` de Google Fonts
 * van acá (no en el HTML original) porque Next.js los hoistea a `<head>`
 * automáticamente al renderizarlos en cualquier punto del árbol. */
export function AhorroFiscalApp({ app }: { app: PublicMiniAppView<"calculadora_ahorro_fiscal"> }) {
  const { brand } = app.config;

  const data = {
    slug: app.slug,
    brand: {
      advisorName: brand.advisorName,
      title: brand.title,
      whatsapp: brand.whatsapp,
      email: brand.email,
      photoURL: brand.photoURL,
      logoURL: app.branding.logoUrl || brand.logoURL,
      calendlyURL: brand.calendlyURL,
      webhookURL: brand.webhookURL,
      avisoPrivacidadURL: brand.avisoPrivacidadURL,
      colorMarca: brand.colorMarca,
      urlRetiro: brand.urlRetiro,
      urlDiagnostico: brand.urlDiagnostico,
      credenciales: brand.credenciales,
    },
  };

  // Escapa "<" para que ningún valor editable (nombre, título, etc.) pueda
  // cerrar el <script> antes de tiempo — mismo criterio que
  // MetaUniversitariaApp/DiagnosticoSolidezApp.
  const serializedData = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- regla pensada para _document.js del Pages Router; en App Router cargar la fuente por ruta (Server Component) es el patrón correcto cuando next/font no aplica (fuente variable con ejes ital/opsz que solo este Mini App usa). */}
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,ital,wght@9..144,0,500;9..144,0,600;9..144,0,700;9..144,1,500&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <style dangerouslySetInnerHTML={{ __html: AHORRO_FISCAL_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: AHORRO_FISCAL_BODY_HTML }} />
      <script dangerouslySetInnerHTML={{ __html: `window.__AHORRO_FISCAL_DATA__=${serializedData};` }} />
      <script dangerouslySetInnerHTML={{ __html: AHORRO_FISCAL_LOGIC_JS }} />
    </>
  );
}
