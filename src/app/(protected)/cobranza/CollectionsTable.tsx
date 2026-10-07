"use client";

import { Ban, CheckCircle2, MessageCircle, MoreHorizontal, CalendarClock, Table } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import type { CollectionItem } from "@/lib/collections/queries";
import { deriveCollectionBucket, COLLECTION_BUCKET_LABEL, COLLECTION_BUCKET_VARIANT, type CollectionBucket } from "@/lib/collections/constants";
import { formatCurrency } from "@/lib/utils/format";

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

/** Grupos de la lista en celular, en el orden de atención: lo vencido primero. */
const MOBILE_GROUPS: { label: string; buckets: CollectionBucket[]; variant: "success" | "error" | "warning" | "info" | "neutral" }[] = [
  { label: "Vencidos", buckets: ["vencido"], variant: "error" },
  { label: "Esta semana", buckets: ["proximo"], variant: "warning" },
  { label: "Programados", buckets: ["en_seguimiento", "pendiente"], variant: "info" },
  { label: "Cobrados", buckets: ["pagado"], variant: "success" },
  { label: "Cancelados", buckets: ["cancelado"], variant: "neutral" },
];

const BUCKET_BORDER: Record<CollectionBucket, string> = {
  vencido: "border-l-error-strong",
  proximo: "border-l-warning-strong",
  en_seguimiento: "border-l-info-strong",
  pendiente: "border-l-info-strong",
  pagado: "border-l-success-strong",
  cancelado: "border-l-neutral-300",
};

function daysLate(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((today.getTime() - new Date(y, m - 1, d).getTime()) / 86_400_000);
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

  const actionsFor = (item: CollectionItem) => {
    const isOpen = item.status === "pendiente" || item.status === "en_seguimiento";
    const wa = whatsAppHref(item);
    return [
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
    ];
  };

  return (
    <>
      <div className="flex flex-col gap-1 md:hidden">
        {MOBILE_GROUPS.map((group) => {
          const groupItems = items
            .filter((i) => group.buckets.includes(deriveCollectionBucket(i.status, i.dueDate)))
            .sort((x, y) => x.dueDate.localeCompare(y.dueDate));
          if (groupItems.length === 0) return null;
          return (
            <section key={group.label} aria-label={group.label}>
              <p className="mx-1 mb-2 mt-3 flex items-center gap-2 text-[13.5px] font-semibold text-neutral-500">
                {group.label}
                <Badge variant={group.variant}>{groupItems.length}</Badge>
              </p>
              <ul className="flex flex-col gap-2">
                {groupItems.map((item) => {
                  const bucket = deriveCollectionBucket(item.status, item.dueDate);
                  const isOpen = item.status === "pendiente" || item.status === "en_seguimiento";
                  const wa = whatsAppHref(item);
                  const late = daysLate(item.dueDate);
                  return (
                    <li key={item.id} className={`flex flex-col gap-2 rounded-2xl border border-l-4 border-border-default bg-surface-1 p-3 ${BUCKET_BORDER[bucket]}`}>
                      <div className="flex items-start justify-between gap-2">
                        <button type="button" onClick={() => onOpen(item)} className="min-w-0 text-left">
                          <span className="block truncate text-sm font-semibold text-foreground">{item.contactName}</span>
                          <span className="block truncate text-xs text-neutral-500">
                            {item.company}
                            {item.policyNumber ? ` · ${item.policyNumber}` : item.product ? ` · ${item.product}` : ""}
                          </span>
                        </button>
                        <div className="shrink-0 text-right">
                          <p className="font-mono text-base font-semibold text-foreground">{formatCurrency(item.amount, item.currency)}</p>
                          <p className={`text-xs ${bucket === "vencido" ? "font-semibold text-error-strong" : "text-neutral-500"}`}>
                            {bucket === "pagado" && item.paidAt
                              ? `Cobrado ${formatDate(item.paidAt.slice(0, 10))}`
                              : bucket === "vencido" && late > 0
                                ? `${late} ${late === 1 ? "día" : "días"} de atraso`
                                : `Vence ${formatDate(item.dueDate)}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {isOpen && wa && (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border-default bg-surface-1 px-3 text-[13px] font-medium text-foreground"
                          >
                            <MessageCircle className="size-3.5" aria-hidden="true" />
                            Recordar
                          </a>
                        )}
                        {isOpen && (
                          <button
                            type="button"
                            onClick={() => onRegisterPayment(item)}
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-accent-600 px-3 text-[13px] font-medium text-white hover:bg-accent-700"
                          >
                            <CheckCircle2 className="size-3.5" aria-hidden="true" />
                            Cobrado
                          </button>
                        )}
                        <span className="ml-auto min-w-0 truncate text-xs text-neutral-500">{item.ownerName ?? "Sin asignar"}</span>
                        <DropdownMenu
                          trigger={<MoreHorizontal className="size-4" aria-hidden="true" />}
                          triggerLabel="Acciones"
                          triggerClassName="flex size-11 shrink-0 items-center justify-center rounded-md text-neutral-500"
                          items={actionsFor(item)}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      <div className="hidden overflow-x-auto rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)] md:block">
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
            return (
              <tr key={item.id} className="border-b border-border-default last:border-0 hover:bg-surface-2">
                <td className="px-3 py-2.5">
                  <button type="button" onClick={() => onOpen(item)} data-tour="collections.open-row" className="text-left font-medium text-foreground hover:text-accent-700">
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
                    items={actionsFor(item)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </>
  );
}
