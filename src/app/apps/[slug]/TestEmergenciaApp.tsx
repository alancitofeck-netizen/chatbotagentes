import type { PublicMiniAppView } from "@/lib/miniApps/queries";
import { TEST_EMERGENCIA_CSS, TEST_EMERGENCIA_BODY_HTML, TEST_EMERGENCIA_LOGIC_JS } from "./testEmergenciaTemplate";

/** Sirve el HTML/CSS/JS de "Test de Preparación para Emergencias
 * Financieras" tal cual — ver testEmergenciaTemplate.ts para el detalle de
 * qué cambia y qué no. Server Component simple, mismo criterio que
 * MetaUniversitariaApp/KitEmergenciaApp: sin interactividad React, toda la
 * interacción es el JS vanilla inyectado, sin Tailwind ni el sistema de
 * paleta --ma-* (diseño Fraunces/Hanken Grotesk autocontenido, propio de
 * este tipo). Los `<link>` de Google Fonts van acá (no en el HTML original)
 * porque Next.js los hoistea a `<head>` automáticamente al renderizarlos en
 * cualquier punto del árbol. */
export function TestEmergenciaApp({ app }: { app: PublicMiniAppView<"test_preparacion_emergencia_financiera"> }) {
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
      colorMarca: brand.colorMarca,
      calendlyURL: brand.calendlyURL,
      privacyURL: brand.privacyURL,
      webhookURL: brand.webhookURL,
      kitEmergenciaURL: brand.kitEmergenciaURL,
      fondoEmergenciaURL: brand.fondoEmergenciaURL,
      seguroSaludNombre: brand.seguroSaludNombre,
    },
  };

  // Escapa "<" para que ningún valor editable (nombre, título, etc.) pueda
  // cerrar el <script> antes de tiempo — mismo criterio que
  // MetaUniversitariaApp/KitEmergenciaApp.
  const serializedData = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      {/* eslint-disable-next-line @next/next/no-page-custom-font -- regla pensada para _document.js del Pages Router; en App Router cargar la fuente por ruta (Server Component) es el patrón correcto cuando next/font no aplica (fuente variable propia de este Mini App). */}
      <link
        href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Hanken+Grotesk:wght@400;500;600;700;800&display=swap"
        rel="stylesheet"
      />
      <style dangerouslySetInnerHTML={{ __html: TEST_EMERGENCIA_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: TEST_EMERGENCIA_BODY_HTML }} />
      <script dangerouslySetInnerHTML={{ __html: `window.__TEST_EMERGENCIA_DATA__=${serializedData};` }} />
      <script dangerouslySetInnerHTML={{ __html: TEST_EMERGENCIA_LOGIC_JS }} />
    </>
  );
}
