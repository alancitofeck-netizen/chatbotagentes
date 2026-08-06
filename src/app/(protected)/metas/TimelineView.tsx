"use client";

import { useEffect, useState } from "react";
import { Trophy, Award, History } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { getTimelineAction } from "@/lib/goals/actions";
import type { TimelineEntry } from "@/lib/goals/queries";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

export function TimelineView() {
  const [entries, setEntries] = useState<TimelineEntry[] | null>(null);

  useEffect(() => {
    getTimelineAction().then(setEntries);
  }, []);

  return (
    <Card>
      <CardHeader title="Timeline de hitos" />
      {!entries ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState icon={History} title="Todavía sin hitos" description="Cuando cumplas un objetivo o desbloquees un logro, va a aparecer acá." className="border-none py-6" />
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((e) => (
            <li key={e.id} className="flex gap-3 border-l-2 border-border-default pl-3">
              {e.kind === "goal" ? <Trophy className="mt-0.5 size-4 shrink-0 text-warning-strong" aria-hidden="true" /> : <Award className="mt-0.5 size-4 shrink-0 text-info-strong" aria-hidden="true" />}
              <div className="min-w-0">
                <p className="text-sm text-foreground">{e.title}</p>
                {e.description && <p className="text-xs text-neutral-500">{e.description}</p>}
                <p className="text-xs text-neutral-400">{formatDate(e.date)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
