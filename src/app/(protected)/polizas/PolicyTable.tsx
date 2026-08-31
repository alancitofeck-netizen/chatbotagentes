"use client";

import { Ban, Copy, Mail, MessageCircle, MoreHorizontal, Paperclip, Pencil, Table } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import type { PolicyListItem } from "@/lib/policies/queries";
import { POLICY_STAGES, POLICY_STATUS_BADGE_VARIANT } from "@/lib/policies/constants";
import { formatCurrency } from "@/lib/utils/format";

const INSURANCE_TYPE_LABEL: Record<string, string> = { auto: "Auto", hogar: "Hogar", vida: "Vida", otro: "Otro" };
const PAYMENT_FREQUENCY_LABEL: Record<string, string> = {
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
  unico: "Único",
};
const STAGE_NAME_BY_KEY = new Map(POLICY_STAGES.map((s) => [s.key, s.name]));

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function isSoonOrOverdue(iso: string) {
  const diffDays = (new Date(iso).getTime() - Date.now()) / 86_400_000;
  return diffDays <= 30;
}

function whatsAppHref(policy: PolicyListItem): string | null {
  if (!policy.contactPhone) return null;
  const digits = policy.contactPhone.replace(/\D/g, "");
  const message = `Hola ${policy.contactName}, te escribo sobre tu póliza ${policy.policyNumber ?? ""} de ${policy.company}.`.replace(/\s+/g, " ");
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function emailHref(policy: PolicyListItem): string | null {
  if (!policy.contactEmail) return null;
  const subject = `Tu póliza ${policy.policyNumber ?? ""} — ${policy.company}`;
  const body = `Hola ${policy.contactName},\n\nTe escribo sobre tu póliza ${policy.policyNumber ?? ""} de ${policy.company}.\n\nSaludos.`;
  return `mailto:${policy.contactEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** "Vista Tabla" — misma data ya filtrada/ordenada que el Kanban (dueño:
 * PoliciesBoardShell), solo que como tabla ancha en vez de tarjetas. Mismo
 * overflow-x-auto + min-width que OpportunityTable.tsx (CRM). Acciones por
 * fila vía DropdownMenu (7 acciones no entran como íconos sueltos, a
 * diferencia de OpportunityTable que solo tiene 3). */
export function PolicyTable({
  policies,
  onOpen,
  onOpenDocuments,
  onEdit,
  onDuplicate,
  onCancel,
}: {
  policies: PolicyListItem[];
  onOpen: (policy: PolicyListItem) => void;
  onOpenDocuments: (policy: PolicyListItem) => void;
  onEdit: (policy: PolicyListItem) => void;
  onDuplicate: (policy: PolicyListItem) => void;
  onCancel: (policy: PolicyListItem) => void;
}) {
  if (policies.length === 0) {
    return <EmptyState icon={Table} title="Sin resultados" description="Ninguna póliza coincide con los filtros aplicados." />;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
      <table className="w-full min-w-[1300px] text-left text-sm">
        <thead>
          <tr className="border-b border-border-default text-xs text-neutral-500">
            <th className="px-3 py-2.5 font-medium">Número</th>
            <th className="px-3 py-2.5 font-medium">Cliente</th>
            <th className="px-3 py-2.5 font-medium">Aseguradora</th>
            <th className="px-3 py-2.5 font-medium">Ramo</th>
            <th className="px-3 py-2.5 font-medium">Producto</th>
            <th className="px-3 py-2.5 font-medium">Prima</th>
            <th className="px-3 py-2.5 font-medium">Frecuencia</th>
            <th className="px-3 py-2.5 font-medium">Inicio</th>
            <th className="px-3 py-2.5 font-medium">Vencimiento</th>
            <th className="px-3 py-2.5 font-medium">Estado</th>
            <th className="px-3 py-2.5 font-medium">Ejecutivo</th>
            <th className="px-3 py-2.5 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {policies.map((policy) => {
            const wa = whatsAppHref(policy);
            const email = emailHref(policy);
            return (
              <tr key={policy.id} className="border-b border-border-default last:border-0 hover:bg-surface-2">
                <td className="whitespace-nowrap px-3 py-2.5">
                  <button type="button" onClick={() => onOpen(policy)} className="font-mono text-xs text-foreground hover:text-accent-700">
                    {policy.policyNumber ?? "—"}
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <button type="button" onClick={() => onOpen(policy)} data-tour="policies.open-row" className="text-left font-medium text-foreground hover:text-accent-700">
                    {policy.contactName}
                  </button>
                </td>
                <td className="px-3 py-2.5 text-neutral-600">{policy.company}</td>
                <td className="px-3 py-2.5">
                  <Badge variant="accent">{INSURANCE_TYPE_LABEL[policy.insuranceType] ?? policy.insuranceType}</Badge>
                </td>
                <td className="px-3 py-2.5 text-neutral-600">{policy.product ?? "—"}</td>
                <td className="whitespace-nowrap px-3 py-2.5 font-mono">{policy.premium !== null ? formatCurrency(policy.premium, policy.premiumCurrency) : "—"}</td>
                <td className="px-3 py-2.5 text-neutral-600">{policy.paymentFrequency ? (PAYMENT_FREQUENCY_LABEL[policy.paymentFrequency] ?? policy.paymentFrequency) : "—"}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-neutral-600">{policy.startDate ? formatDate(policy.startDate) : "—"}</td>
                <td className={`whitespace-nowrap px-3 py-2.5 ${policy.endDate && isSoonOrOverdue(policy.endDate) ? "font-medium text-warning-strong" : "text-neutral-600"}`}>
                  {policy.endDate ? formatDate(policy.endDate) : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <Badge variant={POLICY_STATUS_BADGE_VARIANT[policy.status]}>{STAGE_NAME_BY_KEY.get(policy.status) ?? policy.status}</Badge>
                </td>
                <td className="px-3 py-2.5 text-neutral-600">{policy.ownerName ?? "Sin asignar"}</td>
                <td className="px-3 py-2.5">
                  <DropdownMenu
                    trigger={<MoreHorizontal className="size-4" aria-hidden="true" />}
                    triggerLabel="Acciones"
                    items={[
                      { label: "Ver detalle", icon: <Table className="size-4" aria-hidden="true" />, onSelect: () => onOpen(policy) },
                      { label: "Editar", icon: <Pencil className="size-4" aria-hidden="true" />, onSelect: () => onEdit(policy) },
                      { label: "Duplicar", icon: <Copy className="size-4" aria-hidden="true" />, onSelect: () => onDuplicate(policy) },
                      { label: "Adjuntar documentos", icon: <Paperclip className="size-4" aria-hidden="true" />, onSelect: () => onOpenDocuments(policy) },
                      {
                        label: "Enviar por WhatsApp",
                        icon: <MessageCircle className="size-4" aria-hidden="true" />,
                        disabled: !wa,
                        onSelect: () => wa && window.open(wa, "_blank", "noopener,noreferrer"),
                      },
                      {
                        label: "Enviar por Email",
                        icon: <Mail className="size-4" aria-hidden="true" />,
                        disabled: !email,
                        onSelect: () => email && window.open(email, "_blank"),
                      },
                      { label: "Cancelar póliza", icon: <Ban className="size-4" aria-hidden="true" />, destructive: true, onSelect: () => onCancel(policy) },
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
