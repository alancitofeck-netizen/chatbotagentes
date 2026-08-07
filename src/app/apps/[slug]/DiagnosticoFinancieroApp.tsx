import type { PublicMiniAppView } from "@/lib/miniApps/queries";
import { DIAGNOSTICO_CSS, DIAGNOSTICO_BODY_HTML, DIAGNOSTICO_LOGIC_JS } from "./diagnosticoTemplate";

/** Sirve el HTML/CSS/JS de "Diagnóstico Interactivo Financiero" tal cual —
 * ver diagnosticoTemplate.ts para el detalle de qué cambia y qué no. Server
 * Component simple: no hay interactividad React acá, toda la interacción
 * es el JS vanilla inyectado (mismo motivo por el que este tipo, a
 * diferencia de RetirementSimulatorApp/CalculadoraBrechaApp, no usa
 * Tailwind ni el sistema de paleta --ma-*: tiene su propio diseño
 * autocontenido y debe verse 100% igual al original). */
export function DiagnosticoFinancieroApp({ app }: { app: PublicMiniAppView<"diagnostico_financiero"> }) {
  const { agente, questions, levels } = app.config;

  const data = {
    slug: app.slug,
    agente: {
      nombre: agente.nombre,
      marca: agente.marca,
      rol: agente.rol,
      logoUrl: app.branding.logoUrl ?? "",
      iniciales: "",
      badge: agente.badge,
      titulo: agente.titulo,
      subtitulo: agente.subtitulo,
      whatsapp: agente.whatsapp,
      ctaUrl: agente.ctaUrl,
      webhookUrl: agente.webhookUrl,
      time: agente.time,
    },
    questions,
    levels,
  };

  // Escapa "<" para que ningún valor editable (título, preguntas, etc.)
  // pueda cerrar el <script> antes de tiempo (equivalente a "</scr"+"ipt>"
  // inyectado en el JSON) — mismo riesgo que cualquier JSON embebido inline
  // en HTML, mitigado igual que Next/React ya lo hacen para JSON-LD.
  const serializedData = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DIAGNOSTICO_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: DIAGNOSTICO_BODY_HTML }} />
      <script dangerouslySetInnerHTML={{ __html: `window.__DIAGNOSTICO_DATA__=${serializedData};` }} />
      <script dangerouslySetInnerHTML={{ __html: DIAGNOSTICO_LOGIC_JS }} />
    </>
  );
}
