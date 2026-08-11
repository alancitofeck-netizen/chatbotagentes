"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { toast } from "@/components/toast/toast";
import { updateWorkspaceTheme } from "@/lib/profile/actions";
import type { WorkspaceTheme } from "@/lib/auth/session";
import { cn } from "@/lib/utils/cn";

interface ThemeOption {
  id: WorkspaceTheme;
  name: string;
  description: string;
  /** Colores literales (no CSS vars) — la card de preview tiene que mostrar
   * los 4 temas a la vez, sin importar cuál está activo hoy. Mismos valores
   * que los bloques [data-workspace-theme] de globals.css. */
  preview: { bg: string; surface: string; sidebar: string; accent: string; text: string };
}

const THEMES: ThemeOption[] = [
  {
    id: "growthlink",
    name: "GrowthLink",
    description: "El tema actual",
    preview: { bg: "#f8f9fb", surface: "#ffffff", sidebar: "#0b0f19", accent: "#6c63ff", text: "#101828" },
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Cyan & Blue",
    preview: { bg: "#f0fbfc", surface: "#ffffff", sidebar: "#0b3b6f", accent: "#17b8cc", text: "#0f2a3d" },
  },
  {
    id: "lime-dark",
    name: "Lime Dark",
    description: "Black & Lime",
    preview: { bg: "#0a0a0a", surface: "#141414", sidebar: "#0d0d0d", accent: "#9cff00", text: "#f5f5f5" },
  },
  {
    id: "violet",
    name: "Violet",
    description: "Purple & Lavender",
    preview: { bg: "#14101f", surface: "#1c1730", sidebar: "#120d1f", accent: "#6c41c8", text: "#f2eefa" },
  },
];

/** Mini mockup del CRM (sidebar + card + botón) con los colores reales del
 * tema — no un simple swatch de colores, para que se entienda cómo se va a
 * ver el CRM completo, no solo "qué color es". */
function ThemePreview({ preview }: { preview: ThemeOption["preview"] }) {
  return (
    <div className="flex h-24 overflow-hidden rounded-md border border-border-default" style={{ backgroundColor: preview.bg }}>
      <div className="flex w-7 shrink-0 flex-col items-center gap-1.5 py-2" style={{ backgroundColor: preview.sidebar }}>
        <span className="size-2.5 rounded-full" style={{ backgroundColor: preview.accent }} />
        <span className="h-1 w-3 rounded-full opacity-40" style={{ backgroundColor: preview.text }} />
        <span className="h-1 w-3 rounded-full opacity-40" style={{ backgroundColor: preview.text }} />
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2.5">
        <div className="flex-1 rounded-sm p-2" style={{ backgroundColor: preview.surface }}>
          <span className="block h-1.5 w-10 rounded-full opacity-70" style={{ backgroundColor: preview.text }} />
          <span className="mt-1.5 block h-1 w-14 rounded-full opacity-30" style={{ backgroundColor: preview.text }} />
        </div>
        <span className="h-2 w-8 rounded-full" style={{ backgroundColor: preview.accent }} />
      </div>
    </div>
  );
}

/** data-workspace-theme vive en un div dentro de (protected)/layout.tsx (no
 * en <html>) — ver 0122_workspace_theme.sql. Aplicación optimista (igual
 * que ThemeProvider.tsx hace con el toggle claro/oscuro): cambia el
 * atributo en el DOM al toque, sin esperar el round-trip al server. */
function applyThemeOptimistically(theme: WorkspaceTheme) {
  document.querySelector<HTMLElement>("[data-workspace-theme]")?.setAttribute("data-workspace-theme", theme);
}

export function AppearanceSection({ currentTheme, canManage }: { currentTheme: WorkspaceTheme; canManage: boolean }) {
  const [selected, setSelected] = useState(currentTheme);
  const [isPending, startTransition] = useTransition();

  function handleSelect(theme: WorkspaceTheme) {
    if (!canManage || theme === selected || isPending) return;
    const previous = selected;
    setSelected(theme);
    applyThemeOptimistically(theme);
    startTransition(async () => {
      try {
        await updateWorkspaceTheme(theme);
        toast.success("Tema del workspace actualizado.");
      } catch (err) {
        setSelected(previous);
        applyThemeOptimistically(previous);
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar el tema.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Apariencia" />
        <p className="-mt-2 mb-4 text-sm text-neutral-500">Personalizá la apariencia de tu Workspace.</p>
        {!canManage && <p className="mb-4 text-xs text-neutral-500">Solo Owner/Admin puede cambiar el tema del workspace.</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {THEMES.map((t) => {
            const isSelected = selected === t.id;
            return (
              <button
                key={t.id}
                type="button"
                disabled={!canManage}
                onClick={() => handleSelect(t.id)}
                className={cn(
                  "flex flex-col gap-3 rounded-lg border-2 p-3 text-left transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] disabled:cursor-not-allowed disabled:opacity-60",
                  isSelected ? "border-accent-500" : "border-transparent bg-surface-2 hover:border-border-strong",
                )}
              >
                <ThemePreview preview={t.preview} />
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-neutral-500">{t.description}</p>
                  </div>
                  {isSelected && (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white">
                      <Check className="size-3" aria-hidden="true" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
