import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicMiniAppBySlug } from "@/lib/miniApps/queries";
import { generateMiniAppPalette, toCssDeclarations } from "@/lib/miniApps/paletteEngine";
import { RetirementSimulatorApp } from "./RetirementSimulatorApp";
import { CalculadoraBrechaApp } from "./CalculadoraBrechaApp";
import { LinkedAppLanding } from "./LinkedAppLanding";
import { DiagnosticoFinancieroApp } from "./DiagnosticoFinancieroApp";
import { DiagnosticoRetiroApp } from "./DiagnosticoRetiroApp";
import { DiagnosticoSolidezApp } from "./DiagnosticoSolidezApp";
import { MetaUniversitariaApp } from "./MetaUniversitariaApp";

const THEME_SELECTOR = '[data-mini-app-theme="true"]';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const app = await getPublicMiniAppBySlug(slug);
  return { title: app ? `${app.name} — Growth Link` : "Mini App — Growth Link" };
}

/** Fully public route — a top-level page outside (protected)/(auth), same
 * precedent as src/app/privacy/page.tsx. middleware.ts's PROTECTED_PREFIXES
 * only covers /dashboard and /select-workspace, so this needs no changes
 * there to stay unauthenticated. */
export default async function MiniAppPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const app = await getPublicMiniAppBySlug(slug);
  if (!app) notFound();

  // Computed once per request (pure arithmetic, no I/O) rather than on the
  // client — this page is public/high-traffic, so this keeps the generated
  // theme in the initial HTML with no flash-of-default-color and no extra
  // client JS. Same light/dark-override shape the sitewide globals.css
  // itself uses: prefers-color-scheme as the default signal, with explicit
  // html[data-theme] overrides for a visitor who toggled the site's own
  // theme switch (see docs/blueprint/14-design-system.md).
  const palette = generateMiniAppPalette(app.branding.primaryColor, app.branding.secondaryColor);
  const themeCss = `
    ${THEME_SELECTOR} { ${toCssDeclarations(palette.light)} }
    @media (prefers-color-scheme: dark) { ${THEME_SELECTOR} { ${toCssDeclarations(palette.dark)} } }
    html[data-theme="dark"] ${THEME_SELECTOR} { ${toCssDeclarations(palette.dark)} }
    html[data-theme="light"] ${THEME_SELECTOR} { ${toCssDeclarations(palette.light)} }
  `;

  if (app.templateKey === "simulador_retiro") {
    return (
      <>
        <style>{themeCss}</style>
        <RetirementSimulatorApp app={app} />
      </>
    );
  }

  if (app.templateKey === "calculadora_brecha_retiro") {
    return (
      <>
        <style>{themeCss}</style>
        <CalculadoraBrechaApp app={app} />
      </>
    );
  }

  if (app.templateKey === "app_vinculada") {
    return (
      <>
        <style>{themeCss}</style>
        <LinkedAppLanding app={app} />
      </>
    );
  }

  if (app.templateKey === "diagnostico_financiero") {
    // Sin themeCss/--ma-* — este tipo tiene su propio sistema visual
    // autocontenido (ver DiagnosticoFinancieroApp.tsx), no el de paletteEngine.
    return <DiagnosticoFinancieroApp app={app} />;
  }

  if (app.templateKey === "diagnostico_financiero_retiro") {
    // Mismo motivo que diagnostico_financiero: diseño navy/dorado
    // autocontenido (ver DiagnosticoRetiroApp.tsx), sin themeCss/--ma-*.
    return <DiagnosticoRetiroApp app={app} />;
  }

  if (app.templateKey === "diagnostico_solidez_financiera") {
    // Mismo motivo que diagnostico_financiero: diseño Fraunces/Hanken
    // Grotesk autocontenido (ver DiagnosticoSolidezApp.tsx), sin
    // themeCss/--ma-*.
    return <DiagnosticoSolidezApp app={app} />;
  }

  if (app.templateKey === "calculadora_meta_universitaria") {
    // Mismo motivo que diagnostico_solidez_financiera: diseño Fraunces/
    // Hanken Grotesk autocontenido (ver MetaUniversitariaApp.tsx), sin
    // themeCss/--ma-*.
    return <MetaUniversitariaApp app={app} />;
  }

  notFound();
}
