import type { PublicMiniAppView } from "@/lib/miniApps/queries";
import { DIAGNOSTICO_SOLIDEZ_CSS, DIAGNOSTICO_SOLIDEZ_BODY_HTML, DIAGNOSTICO_SOLIDEZ_LOGIC_JS } from "./diagnosticoSolidezTemplate";

/** Sirve el HTML/CSS/JS de "Diagnóstico de Solidez Financiera" tal cual —
 * ver diagnosticoSolidezTemplate.ts para el detalle de qué cambia y qué no.
 * Server Component simple, mismo criterio que DiagnosticoFinancieroApp: sin
 * interactividad React, toda la interacción es el JS vanilla inyectado, y
 * sin Tailwind ni el sistema de paleta --ma-* (diseño Fraunces/Hanken
 * Grotesk autocontenido, propio de este tipo). Los `<link>` de Google Fonts
 * van acá (no en el HTML original) porque Next.js los hoistea a `<head>`
 * automáticamente al renderizarlos en cualquier punto del árbol — la fuente
 * nunca se cargaba desde el layout raíz (que solo trae Geist). */
export function DiagnosticoSolidezApp({ app }: { app: PublicMiniAppView<"diagnostico_solidez_financiera"> }) {
  const { brand, themeActive } = app.config;

  const data = {
    slug: app.slug,
    theme: themeActive,
    brand: {
      advisorName: brand.advisorName,
      companyName: brand.companyName,
      title: brand.title,
      badge: brand.badge,
      photoURL: brand.photoURL,
      logoURL: app.branding.logoUrl || brand.logoURL,
      whatsapp: brand.whatsapp,
      calendly: brand.calendly,
      privacyURL: brand.privacyURL,
      advisorID: brand.advisorID,
      webhookURL: brand.webhookURL,
      waGreeting: brand.waGreeting,
    },
  };

  // Escapa "<" para que ningún valor editable (nombre, badge, etc.) pueda
  // cerrar el <script> antes de tiempo — mismo criterio que
  // DiagnosticoFinancieroApp/DiagnosticoRetiroApp.
  const serializedData = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- regla pensada para _document.js del Pages Router; en App Router cargar la fuente por ruta (Server Component) es el patrón correcto cuando next/font no aplica (fuente variable con ejes ital/opsz que solo este Mini App usa). */}
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,ital,wght@9..144,0,400;9..144,0,500;9..144,0,600;9..144,0,700;9..144,1,500;9..144,1,600&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <style dangerouslySetInnerHTML={{ __html: DIAGNOSTICO_SOLIDEZ_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: DIAGNOSTICO_SOLIDEZ_BODY_HTML }} />
      <script dangerouslySetInnerHTML={{ __html: `window.__DIAGNOSTICO_SOLIDEZ_DATA__=${serializedData};` }} />
      <script dangerouslySetInnerHTML={{ __html: DIAGNOSTICO_SOLIDEZ_LOGIC_JS }} />
    </>
  );
}
