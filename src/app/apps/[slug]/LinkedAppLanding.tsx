"use client";

/** Public landing for "App Vinculada" (botón "Vincular App"). Dos modos,
 * distinguidos por `app.config.hostingMode`:
 * - "url" (Fase 1): GrowthLink no aloja la app externa, solo la conecta, así
 *   que es un aterrizaje breve con un botón hacia `app.externalUrl`, no un
 *   iframe — muchos sitios externos envían X-Frame-Options/frame-ancestors
 *   que dejarían un iframe en blanco sin aviso, mientras que un enlace
 *   directo siempre funciona.
 * - "upload" (Fase 2): GrowthLink SÍ aloja el HTML/ZIP subido, y se debe ver
 *   EXACTAMENTE igual que abrir ese HTML directamente — sin Card, sin
 *   max-width, sin padding, sin bordes, sin sombra, sin scroll interno
 *   propio. La única UI de GrowthLink es una barra superior delgada
 *   (Volver / nombre / estado / compartir / abrir en pestaña nueva); todo lo
 *   demás del viewport es el iframe (sandbox="allow-scripts allow-forms
 *   allow-popups", deliberadamente sin allow-same-origin: el HTML de un
 *   tercero corre con un origen opaco, así que no puede leer las cookies/DOM
 *   de GrowthLink ni arrastrar la sesión del visitante en sus propios
 *   fetch() — mismo mecanismo que usan CodeSandbox/JSFiddle). */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Calculator, Check, Copy, FileText, Layout, Link2, Presentation, Sparkles, type LucideIcon } from "lucide-react";
import type { PublicMiniAppView } from "@/lib/miniApps/queries";
import type { LinkedAppIconKey } from "@/lib/miniApps/linkedAppOptions";
import { Badge } from "@/components/ui/Badge";
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

  const isHosted = app.config.hostingMode === "upload" && Boolean(app.bundlePublicUrl);
  if (isHosted) return <HostedAppView app={app} />;
  return <ExternalAppLanding app={app} />;
}

/** hostingMode "upload" — full-viewport, chrome-free besides the thin top
 * bar. No Card/max-width/padding/border/shadow: this must be pixel-for-pixel
 * what the visitor would see opening the original HTML file. */
function HostedAppView({ app }: { app: PublicMiniAppView<"app_vinculada"> }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <div className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-border-default bg-surface-1 px-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex shrink-0 items-center gap-1 text-sm text-neutral-500 hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Volver
          </button>
          <span className="truncate text-sm font-medium text-foreground">{app.name}</span>
          <Badge variant="success" dot className="hidden sm:inline-flex">
            Conectada
          </Badge>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-surface-2 hover:text-foreground"
          >
            {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
            {copied ? "Copiado" : "Compartir"}
          </button>
          <a
            href={app.bundlePublicUrl as string}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-500 hover:bg-surface-2 hover:text-foreground"
          >
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Abrir en nueva pestaña</span>
          </a>
        </div>
      </div>
      <iframe
        src={app.bundlePublicUrl as string}
        sandbox="allow-scripts allow-forms allow-popups"
        className="block w-full flex-1 border-0"
        title={app.name}
      />
    </div>
  );
}

/** hostingMode "url" (Fase 1, sin cambios) — GrowthLink no aloja esta app,
 * solo enlaza a `externalUrl`, así que sigue siendo un aterrizaje breve. */
function ExternalAppLanding({ app }: { app: PublicMiniAppView<"app_vinculada"> }) {
  const Icon = ICON_COMPONENTS[app.config.icon as LinkedAppIconKey] ?? Link2;

  return (
    <div data-mini-app-theme="true" className="relative flex min-h-dvh items-center justify-center px-4 py-8 sm:py-12">
      <DecorativeBackground />
      <div className="flex w-full max-w-md flex-col gap-4">
        <AgentBar app={app} badgeLabel="Vinculada" />

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
      </div>
    </div>
  );
}
