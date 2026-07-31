/**
 * Option lists for the "Vincular App" (link an externally-hosted HTML app)
 * template — deliberately client-safe (no "server-only" import, unlike
 * queries.ts) so the wizard/Configuración UI can import the option arrays
 * directly, same split as templateCatalog.ts's category list.
 */

export type LinkedAppType = "html" | "landing_page" | "calculadora" | "presentacion" | "formulario" | "otro";

export const LINKED_APP_TYPE_OPTIONS: { value: LinkedAppType; label: string }[] = [
  { value: "html", label: "HTML" },
  { value: "landing_page", label: "Landing Page" },
  { value: "calculadora", label: "Calculadora" },
  { value: "presentacion", label: "Presentación" },
  { value: "formulario", label: "Formulario" },
  { value: "otro", label: "Otro" },
];

export function linkedAppTypeLabel(type: LinkedAppType): string {
  return LINKED_APP_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? "Otro";
}

/** A small curated icon set (lucide-react icon names) — resolved to an
 * actual component via LINKED_APP_ICON_COMPONENTS in the UI layer, kept as
 * plain strings here so this file stays free of any React/lucide import. */
export const LINKED_APP_ICON_OPTIONS = [
  { value: "Link2", label: "Enlace" },
  { value: "Layout", label: "Landing" },
  { value: "Calculator", label: "Calculadora" },
  { value: "Presentation", label: "Presentación" },
  { value: "FileText", label: "Formulario" },
  { value: "Sparkles", label: "Genérico" },
] as const;

export type LinkedAppIconKey = (typeof LINKED_APP_ICON_OPTIONS)[number]["value"];

export const DEFAULT_LINKED_APP_ICON: LinkedAppIconKey = "Link2";

/** GrowthLink SDK version — lives here (not in the Route Handler that
 * serves it, src/app/api/public/sdk.js/route.ts) so client components like
 * DashboardTab.tsx can display it without importing a route.ts file (which
 * pulls in next/server, meant for the server route context only). Bump
 * whenever the SDK snippet changes in a way that matters to an
 * already-integrated external app. */
export const SDK_VERSION = "1.0.0";
