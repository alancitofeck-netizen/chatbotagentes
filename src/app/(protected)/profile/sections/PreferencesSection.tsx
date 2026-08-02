"use client";

import { Volume2, Globe, Inbox as InboxIcon } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { ThemeToggle } from "@/lib/theme/ThemeToggle";
import { useTheme } from "@/lib/theme/ThemeProvider";
import { NotificationPreferencesCard } from "./NotificationPreferencesCard";

const PLACEHOLDER_ROWS = [
  { icon: Volume2, label: "Sonidos", description: "Sonido al recibir un mensaje nuevo." },
  { icon: Globe, label: "Idioma", description: "Idioma de la interfaz." },
  { icon: InboxIcon, label: "Preferencias del inbox", description: "Orden y agrupación por defecto de conversaciones." },
];

/** Tema es la única preferencia real vía localStorage (ThemeProvider/
 * ThemeToggle, sin backend); Notificaciones (NotificationPreferencesCard) es
 * real vía notification_preferences (Fase 3 del sistema de notificaciones).
 * El resto son placeholders "Próximamente", mismo criterio que ya usa el
 * resto de la app (tab Archivos del Inbox) — no hay multi-idioma ni sonido
 * en ningún lado del proyecto. */
export function PreferencesSection() {
  const { theme } = useTheme();

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Apariencia" />
        <div className="flex items-center justify-between gap-3 py-1">
          <div>
            <p className="text-sm font-medium text-foreground">Tema</p>
            <p className="text-[13px] text-neutral-500">{theme === "dark" ? "Oscuro" : "Claro"}</p>
          </div>
          <ThemeToggle />
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
