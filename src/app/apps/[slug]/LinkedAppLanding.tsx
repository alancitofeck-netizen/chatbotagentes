"use client";

/** Public landing for "App Vinculada" (botón "Vincular App"). Dos modos,
 * distinguidos por `app.config.hostingMode`:
 * - "url" (Fase 1): GrowthLink no aloja la app externa, solo la conecta, así
 *   que es un aterrizaje breve con un botón hacia `app.externalUrl`, no un
 *   iframe — muchos sitios externos envían X-Frame-Options/frame-ancestors
 *   que dejarían un iframe en blanco sin aviso, mientras que un enlace
 *   directo siempre funciona.
 * - "upload" (Fase 2): GrowthLink SÍ aloja el HTML/ZIP subido (Storage
 *   público) — acá sí se renderiza dentro de un
 *   `<iframe sandbox="allow-scripts allow-forms allow-popups">`
 *   (deliberadamente sin allow-same-origin): el HTML de un tercero corre con
 *   un origen opaco, así que no puede leer las cookies/DOM de GrowthLink ni
 *   arrastrar la sesión del visitante en sus propios fetch() — mismo
 *   mecanismo que usan CodeSandbox/JSFiddle para alojar HTML ajeno bajo su
 *   propio dominio. */

import { useEffect } from "react";
import { ArrowUpRight, Calculator, FileText, Layout, Link2, Presentation, Sparkles, type LucideIcon } from "lucide-react";
import type { PublicMiniAppView } from "@/lib/miniApps/queries";
import type { LinkedAppIconKey } from "@/lib/miniApps/linkedAppOptions";
import { AgentBar, DecorativeBackground, MiniAppButton } from "@/components/miniApps/uiPrimitives";

const ICON_COMPONENTS: Record<LinkedAppIconKey, LucideIcon> = {
  Link2,
  Layout,
  Calculator,
  Presentation,
  FileText,
  Sparkles,
};

export function LinkedAppLanding({ app }: { app: PublicMiniAppView<"app_vinculada"> }) {
  useEffect(() => {
    fetch(`/api/public/mini-apps/${app.slug}/visit`, { method: "POST", keepalive: true }).catch(() => {});
  }, [app.slug]);

  const Icon = ICON_COMPONENTS[app.config.icon as LinkedAppIconKey] ?? Link2;
  const isHosted = app.config.hostingMode === "upload" && Boolean(app.bundlePublicUrl);

  return (
    <div data-mini-app-theme="true" className="relative flex min-h-screen items-center justify-center px-4 py-8 sm:py-12">
      <DecorativeBackground />
      <div className={`flex w-full flex-col gap-4 ${isHosted ? "max-w-3xl" : "max-w-md"}`}>
        <AgentBar app={app} badgeLabel="Vinculada" />

        {isHosted ? (
          <div
            className="flex flex-col gap-4 rounded-2xl p-4 sm:p-6"
            style={{ background: "var(--ma-background-surface)", border: "1px solid var(--ma-border)", boxShadow: "var(--ma-shadow-lg)" }}
          >
            <div className="flex items-center gap-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                style={{ background: "var(--ma-gradient-hero)", color: "var(--ma-gradient-hero-text)" }}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-[16px] font-semibold tracking-[-0.01em]" style={{ color: "var(--ma-title-color)" }}>
                  {app.name}
                </h1>
                {app.description && (
                  <p className="text-[13px] leading-snug" style={{ color: "var(--ma-text-muted)" }}>
                    {app.description}
                  </p>
                )}
              </div>
            </div>
            <iframe
              src={app.bundlePublicUrl as string}
              sandbox="allow-scripts allow-forms allow-popups"
              className="h-[70vh] w-full rounded-xl border-0 bg-white"
              title={app.name}
            />
          </div>
        ) : (
          <div
            className="flex flex-col items-center gap-5 rounded-2xl p-8 text-center sm:p-10"
            style={{ background: "var(--ma-background-surface)", border: "1px solid var(--ma-border)", boxShadow: "var(--ma-shadow-lg)" }}
          >
            <span
              className="flex size-16 items-center justify-center rounded-2xl"
              style={{ background: "var(--ma-gradient-hero)", color: "var(--ma-gradient-hero-text)" }}
            >
              <Icon className="size-7" aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-[21px] font-semibold tracking-[-0.01em]" style={{ color: "var(--ma-title-color)" }}>
                {app.name}
              </h1>
              {app.description && (
                <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed" style={{ color: "var(--ma-text-muted)" }}>
                  {app.description}
                </p>
              )}
            </div>
            {app.externalUrl && (
              <MiniAppButton type="button" onClick={() => window.open(app.externalUrl as string, "_blank", "noopener,noreferrer")}>
                Abrir aplicación <ArrowUpRight className="size-4" aria-hidden="true" />
              </MiniAppButton>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
