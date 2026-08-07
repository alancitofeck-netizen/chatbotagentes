"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { History } from "lucide-react";
import type { HistoryEntry } from "@/lib/dataTransfer/queries";
import { formatRelativeTime } from "@/lib/utils/format";

const STATUS_BADGE = { ok: { label: "Correcto", variant: "success" as const }, error: { label: "Error", variant: "error" as const }, partial: { label: "Con errores", variant: "warning" as const } };

export function HistoryTable({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) {
    return <EmptyState icon={History} title="Sin actividad todavía" description="Cada importación y exportación va a aparecer acá." />;
  }

  return (
    <Card className="overflow-hidden !p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border-default bg-surface-2 text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Fecha</th>
              <th className="px-4 py-2.5 font-medium">Acción</th>
              <th className="px-4 py-2.5 font-medium">Usuario</th>
              <th className="px-4 py-2.5 font-medium">Archivo</th>
              <th className="px-4 py-2.5 font-medium">Registros</th>
              <th className="px-4 py-2.5 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {entries.map((e) => {
              const badge = STATUS_BADGE[e.status];
              return (
                <tr key={e.id}>
                  <td className="whitespace-nowrap px-4 py-2.5 text-neutral-500">{formatRelativeTime(e.date)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-foreground">{e.action}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-neutral-500">{e.userName ?? "—"}</td>
                  <td className="max-w-[220px] truncate px-4 py-2.5 text-neutral-500">{e.fileName}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-foreground">{e.records}</td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    <Badge variant={badge.variant}>{badge.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
