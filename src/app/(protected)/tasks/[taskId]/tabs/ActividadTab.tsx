"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import type { TaskActivityEntry } from "@/lib/tasks/queries";
import { getTaskActivityAction } from "@/lib/tasks/actions";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** "Actividad" tab — public.audit_log (entity_type='task'), same mechanism
 * as CardDetailSheet's "Historial" tab for opportunities. */
export function ActividadTab({ taskId }: { taskId: string }) {
  const [activity, setActivity] = useState<TaskActivityEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getTaskActivityAction(taskId).then((fresh) => {
      setActivity(fresh);
      setLoaded(true);
    });
  }, [taskId]);

  if (!loaded) return <Skeleton className="h-24 w-full" />;
  if (activity.length === 0) return <p className="text-sm text-neutral-500">Sin actividad registrada todavía.</p>;

  return (
    <ul className="flex flex-col gap-3">
      {activity.map((a) => (
        <li key={a.id} className="rounded-md bg-surface-2 p-3">
          <p className="text-sm font-medium text-foreground">
            {a.action}
            {typeof a.metadata.status === "string" ? `: ${a.metadata.status}` : ""}
            {typeof a.metadata.type === "string" ? ` (${a.metadata.type})` : ""}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {formatDate(a.createdAt)}
            {a.actorName && ` · ${a.actorName}`}
          </p>
        </li>
      ))}
    </ul>
  );
}
