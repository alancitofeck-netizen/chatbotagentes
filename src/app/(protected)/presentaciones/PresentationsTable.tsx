"use client";

import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Copy, Trash2, Presentation as PresentationIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import type { PresentationListItem } from "@/lib/presentations/queries";
import { PRESENTATION_STATUS_LABEL, PRESENTATION_STATUS_VARIANT } from "@/lib/presentations/constants";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

export function PresentationsTable({
  items,
  onDuplicate,
  onDelete,
}: {
  items: PresentationListItem[];
  onDuplicate: (item: PresentationListItem) => void;
  onDelete: (item: PresentationListItem) => void;
}) {
  const router = useRouter();

  if (items.length === 0) {
    return <EmptyState icon={PresentationIcon} title="Todavía no hay presentaciones" description="Creá tu primera presentación con el botón de arriba." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
      <table className="w-full min-w-[800px] text-left text-sm">
        <thead>
          <tr className="border-b border-border-default text-xs text-neutral-500">
            <th className="px-3 py-2.5 font-medium">Presentación</th>
            <th className="px-3 py-2.5 font-medium">Cliente</th>
            <th className="px-3 py-2.5 font-medium">Fecha</th>
            <th className="px-3 py-2.5 font-medium">Estado</th>
            <th className="px-3 py-2.5 font-medium">Compartida</th>
            <th className="px-3 py-2.5 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-border-default last:border-0 hover:bg-surface-2">
              <td className="px-3 py-2.5">
                <button type="button" onClick={() => router.push(`/presentaciones/${item.id}`)} className="text-left font-medium text-foreground hover:text-accent-700">
                  {item.title}
                </button>
              </td>
              <td className="px-3 py-2.5 text-neutral-600">{item.clientLabel ?? "—"}</td>
              <td className="whitespace-nowrap px-3 py-2.5 text-neutral-600">{formatDate(item.updatedAt)}</td>
              <td className="px-3 py-2.5">
                <Badge variant={PRESENTATION_STATUS_VARIANT[item.status]}>{PRESENTATION_STATUS_LABEL[item.status]}</Badge>
              </td>
              <td className="px-3 py-2.5">
                {item.shareSlug ? <Badge variant="success">Sí · {item.shareViewsCount} vistas</Badge> : <Badge variant="neutral">No</Badge>}
              </td>
              <td className="px-3 py-2.5">
                <DropdownMenu
                  trigger={<MoreHorizontal className="size-4" aria-hidden="true" />}
                  triggerLabel="Acciones"
                  items={[
                    { label: "Editar", icon: <Pencil className="size-4" aria-hidden="true" />, onSelect: () => router.push(`/presentaciones/${item.id}`) },
                    { label: "Duplicar", icon: <Copy className="size-4" aria-hidden="true" />, onSelect: () => onDuplicate(item) },
                    { label: "Eliminar", icon: <Trash2 className="size-4" aria-hidden="true" />, destructive: true, onSelect: () => onDelete(item) },
                  ]}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
