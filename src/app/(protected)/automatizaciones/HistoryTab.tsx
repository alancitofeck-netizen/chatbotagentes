"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, XCircle, History } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { formatRelativeTime } from "@/lib/utils/format";
import { getAutomationHistoryAction } from "@/lib/automationTemplates/actions";
import type { AutomationHistoryEntry } from "@/lib/automationTemplates/queries";
import { AUTOMATION_ICON_MAP } from "./icons";

export function HistoryTab() {
  const [entries, setEntries] = useState<AutomationHistoryEntry[] | null>(null);

  useEffect(() => {
    getAutomationHistoryAction().then(setEntries);
  }, []);

  if (entries === null) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (entries.length === 0) {
    return <EmptyState icon={History} title="Sin ejecuciones todavía" description="Acá vas a ver cada vez que una automatización se dispare: para quién y si tuvo éxito." />;
  }

  return (
    <ul className="flex flex-col divide-y divide-border-default overflow-hidden rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
      {entries.map((entry) => {
        const Icon = AUTOMATION_ICON_MAP[entry.icon as keyof typeof AUTOMATION_ICON_MAP] ?? AUTOMATION_ICON_MAP.Sparkles;
        return (
          <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
              <Icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{entry.automationName}</p>
              <p className="truncate text-[13px] text-neutral-500">{entry.entityLabel ?? "—"}</p>
              {entry.status === "failed" && entry.error && <p className="truncate text-xs text-error-strong">{entry.error}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              {entry.status === "completed" ? (
                <CheckCircle2 className="size-4 text-success-strong" aria-hidden="true" />
              ) : (
                <XCircle className="size-4 text-error-strong" aria-hidden="true" />
              )}
              <span className="text-xs text-neutral-400">{formatRelativeTime(entry.createdAt)}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
