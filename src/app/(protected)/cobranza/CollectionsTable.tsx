"use client";

import { Ban, CheckCircle2, MessageCircle, MoreHorizontal, CalendarClock, Table } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import type { CollectionItem } from "@/lib/collections/queries";
import { deriveCollectionBucket, COLLECTION_BUCKET_LABEL, COLLECTION_BUCKET_VARIANT } from "@/lib/collections/constants";
import { formatCurrency } from "@/lib/utils/format";

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function whatsAppHref(item: CollectionItem): string | null {
  if (!item.contactPhone) return null;
  const digits = item.contactPhone.replace(/\D/g, "");
  const message = `Hola ${item.contactName}, te escribo por el pago de ${formatCurrency(item.amount, item.currency)} de tu póliza de ${item.company}.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/** "Vista Tabla" — mismo criterio que PolicyTable: overflow-x-auto + acciones
 * por fila vía DropdownMenu. */
export function CollectionsTable({
  items,
  onOpen,
  onRegisterPayment,
  onReschedule,
  onCancel,
}: {
  items: CollectionItem[];
  onOpen: (item: CollectionItem) => void;
  onRegisterPayment: (item: CollectionItem) => void;
  onReschedule: (item: CollectionItem) => void;
  onCancel: (item: CollectionItem) => void;
}) {
  if (items.length === 0) {
    return <EmptyState icon={Table} title="Sin resultados" description="Ningún cobro coincide con los filtros aplicados." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
      <table className="w-full min-w-[1100px] text-left text-sm">
        <thead>
          <tr className="border-b border-border-default text-xs text-neutral-500">
            <th className="px-3 py-2.5 font-medium">Cliente</th>
            <th className="px-3 py-2.5 font-medium">Aseguradora / Póliza</th>
            <th className="px-3 py-2.5 font-medium">Monto</th>
            <th className="px-3 py-2.5 font-medium">Vencimiento</th>
            <th className="px-3 py-2.5 font-medium">Estado</th>
            <th className="px-3 py-2.5 font-medium">Ejecutivo</th>
            <th className="px-3 py-2.5 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const bucket = deriveCollectionBucket(item.status, item.dueDate);
            const wa = whatsAppHref(item);
            const isOpen = item.status === "pendiente" || item.status === "en_seguimiento";
            return (
              <tr key={item.id} className="border-b border-border-default last:border-0 hover:bg-surface-2">
                <td className="px-3 py-2.5">
                  <button type="button" onClick={() => onOpen(item)} className="text-left font-medium text-foreground hover:text-accent-700">
                    {item.contactName}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-neutral-600">
                  {item.company}
                  {item.policyNumber ? ` · ${item.policyNumber}` : ""}
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono">{formatCurrency(item.amount, item.currency)}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-neutral-600">{formatDate(item.dueDate)}</td>
                <td className="px-3 py-2.5">
                  <Badge variant={COLLECTION_BUCKET_VARIANT[bucket]}>{COLLECTION_BUCKET_LABEL[bucket]}</Badge>
                </td>
                <td className="px-3 py-2.5 text-neutral-600">{item.ownerName ?? "Sin asignar"}</td>
                <td className="px-3 py-2.5">
                  <DropdownMenu
                    trigger={<MoreHorizontal className="size-4" aria-hidden="true" />}
                    triggerLabel="Acciones"
                    items={[
                      { label: "Ver detalle", icon: <Table className="size-4" aria-hidden="true" />, onSelect: () => onOpen(item) },
                      {
                        label: "Registrar pago",
                        icon: <CheckCircle2 className="size-4" aria-hidden="true" />,
                        disabled: !isOpen,
                        onSelect: () => onRegisterPayment(item),
                      },
                      { label: "Reprogramar", icon: <CalendarClock className="size-4" aria-hidden="true" />, disabled: !isOpen, onSelect: () => onReschedule(item) },
                      {
                        label: "Enviar por WhatsApp",
                        icon: <MessageCircle className="size-4" aria-hidden="true" />,
                        disabled: !wa,
                        onSelect: () => wa && window.open(wa, "_blank", "noopener,noreferrer"),
                      },
                      { label: "Cancelar cobro", icon: <Ban className="size-4" aria-hidden="true" />, destructive: true, disabled: !isOpen, onSelect: () => onCancel(item) },
                    ]}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
