"use client";

import { Sheet } from "@/components/ui/Sheet";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils/format";
import { POLICY_STAGES, POLICY_STATUS_BADGE_VARIANT, type PolicyStatus } from "@/lib/policies/constants";
import { COLLECTION_BUCKET_LABEL, COLLECTION_BUCKET_VARIANT, deriveCollectionBucket } from "@/lib/collections/constants";
import type { AgencyPolicyRow, AgencyPolicyPaymentRow } from "@/lib/kpis/agencyOperations";

const STAGE_NAME: Record<PolicyStatus, string> = Object.fromEntries(POLICY_STAGES.map((s) => [s.key, s.name])) as Record<PolicyStatus, string>;

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

/** Drawer de solo lectura para "Pólizas recientes" de Operaciones — a
 * propósito NO es el PolicyDetailSheet completo de /polizas (ese está atado
 * al workspace de sesión, no a una lectura cross-asesor); esta es una vista
 * liviana, sin acciones de edición, para no adaptar ese componente rico a
 * un criterio cross-tenant que no necesita esta pasada. Para editar, el
 * asesor lo hace desde su propio módulo Pólizas. */
export function PolicyDetailDrawer({ policy, payments, onClose }: { policy: AgencyPolicyRow; payments: AgencyPolicyPaymentRow[]; onClose: () => void }) {
  const policyPayments = payments.filter((p) => p.policyId === policy.id);

  return (
    <Sheet open onClose={onClose} title={policy.policyNumber ? `Póliza ${policy.policyNumber}` : policy.product}>
      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={POLICY_STATUS_BADGE_VARIANT[policy.status]}>{STAGE_NAME[policy.status]}</Badge>
          <span className="text-xs text-neutral-500">Cargada {fmtDate(policy.createdAt)}</span>
        </div>

        <div>
          <p className="text-[15px] font-semibold text-foreground">{policy.contactName ?? "Sin cliente"}</p>
          <p className="text-sm text-neutral-500">Asesor: {policy.advisorName}</p>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-neutral-500">Aseguradora</dt>
            <dd className="text-foreground">{policy.company}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Producto</dt>
            <dd className="text-foreground">{policy.product}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Tipo</dt>
            <dd className="capitalize text-foreground">{policy.insuranceType}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Origen</dt>
            <dd className="text-foreground">{policy.source === "portal_sync" ? "Sincronizada" : policy.source === "pdf_ai" ? "PDF (IA)" : policy.source === "import" ? "Importada" : "Manual"}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Prima</dt>
            <dd className="text-foreground">{policy.premium !== null ? formatCurrency(policy.premium, policy.premiumCurrency ?? "USD") : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Frecuencia</dt>
            <dd className="capitalize text-foreground">{policy.paymentFrequency ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Comisión</dt>
            <dd className="text-foreground">{policy.commissionAmount !== null ? formatCurrency(policy.commissionAmount, policy.premiumCurrency ?? "USD") : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Estado comisión</dt>
            <dd className="capitalize text-foreground">{policy.commissionStatus ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Inicio de vigencia</dt>
            <dd className="text-foreground">{fmtDate(policy.startDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Vencimiento</dt>
            <dd className="text-foreground">{fmtDate(policy.endDate)}</dd>
          </div>
          {policy.renewalDate && (
            <div>
              <dt className="text-xs text-neutral-500">Próxima renovación</dt>
              <dd className="text-foreground">{fmtDate(policy.renewalDate)}</dd>
            </div>
          )}
        </dl>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Cuotas</p>
          {policyPayments.length === 0 ? (
            <p className="text-sm text-neutral-500">Sin cronograma de pagos cargado.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border-default">
              {policyPayments.map((p) => {
                const bucket = deriveCollectionBucket(p.status, p.dueDate);
                return (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="text-foreground">{fmtDate(p.dueDate)}</span>
                    <span className="font-mono text-neutral-500">{formatCurrency(p.amount, p.currency)}</span>
                    <Badge variant={COLLECTION_BUCKET_VARIANT[bucket]}>{COLLECTION_BUCKET_LABEL[bucket]}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Sheet>
  );
}
