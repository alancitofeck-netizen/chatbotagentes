"use client";

import { Volume2, Globe, Inbox as InboxIcon, Sun, Moon, Monitor } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { cn } from "@/lib/utils/cn";
import { useCompactPreference } from "../useCompactPreference";
import { NotificationPreferencesCard } from "./NotificationPreferencesCard";

const PLACEHOLDER_ROWS = [
  { icon: Volume2, label: "Sonidos", description: "Sonido al recibir un mensaje nuevo." },
  { icon: Globe, label: "Idioma", description: "Idioma de la interfaz." },
  { icon: InboxIcon, label: "Preferencias del inbox", description: "Orden y agrupación por defecto de conversaciones." },
];

const MODE_OPTIONS = [
  { key: "light" as const, label: "Claro", icon: Sun },
  { key: "dark" as const, label: "Oscuro", icon: Moon },
  { key: "system" as const, label: "Sistema", icon: Monitor },
];

/** Tema (con la opción "Sistema" real, no solo el fallback implícito — ver
 * ThemeProvider.tsx) y vista compacta son preferencias reales vía
 * localStorage, sin backend; Notificaciones (NotificationPreferencesCard) es
 * real vía notification_preferences (Fase 3 del sistema de notificaciones).
 * El resto son placeholders "Próximamente", mismo criterio que ya usa el
 * resto de la app (tab Archivos del Inbox) — no hay multi-idioma ni sonido
 * en ningún lado del proyecto. */
export function PreferencesSection() {
  const { mode, setMode } = useTheme();
  const [compact, setCompact] = useCompactPreference();

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Apariencia" />
        <div className="flex flex-col gap-1 py-1">
          <p className="text-sm font-medium text-foreground">Tema</p>
          <div className="mt-1 grid grid-cols-3 gap-2">
            {MODE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                role="radio"
                aria-checked={mode === opt.key}
                onClick={() => setMode(opt.key)}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-md border px-3 py-2.5 text-xs font-medium transition-colors",
                  mode === opt.key ? "border-accent-500 bg-accent-50 text-accent-700" : "border-border-default text-neutral-500 hover:bg-surface-2",
                )}
              >
                <opt.icon className="size-4" aria-hidden="true" />
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-border-default pt-4">
          <div>
            <p className="text-sm font-medium text-foreground">Vista compacta</p>
            <p className="text-[13px] text-neutral-500">Menos espacio entre filas en esta pantalla de Perfil.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={compact}
            onClick={() => setCompact(!compact)}
            className={cn("flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors", compact ? "bg-accent-500" : "bg-surface-3")}
          >
            <span className={cn("size-5 rounded-full bg-white shadow-sm transition-transform", compact && "translate-x-5")} />
          </button>
        </div>
      </Card>

      <NotificationPreferencesCard />

      <Card>
        <CardHeader title="Otras preferencias" />
        <ul className="flex flex-col divide-y divide-border-default">
          {PLACEHOLDER_ROWS.map((row) => (
            <li key={row.label} className="flex items-center justify-between gap-3 py-2.5">
              <div className="flex items-center gap-3">
                <row.icon className="size-4 shrink-0 text-neutral-400" />
                <div>
                  <p className="text-sm text-foreground">{row.label}</p>
                  <p className="text-[12px] text-neutral-500">{row.description}</p>
                </div>
              </div>
              <span className="shrink-0 text-[11px] font-medium text-neutral-400">Próximamente</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
