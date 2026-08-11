import type { Metadata } from "next";
import { FileCheck2 } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getClientPolicies } from "@/lib/clients/queries";
import { Card, CardHeader } from "@/components/ui/Card";
import { MetricCard } from "@/components/responseSummary/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Pólizas — Cliente — Growth Link" };

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

const STATUS_LABEL: Record<string, string> = {
  cotizacion: "Cotización",
  documentacion: "Documentación",
  pendiente_emision: "Pendiente de emisión",
  emitida: "Emitida",
  activa: "Activa",
  renovacion_proxima: "Renovación próxima",
  renovacion_enviada: "Renovación enviada",
  renovada: "Renovada",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

/** Reutiliza policies.client_id (0125) — mismas filas que ya administra el
 * módulo Pólizas, nunca una copia. */
export default async function ClientPolizasPage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  const policies = await getClientPolicies(workspaceId, clientId);

  const totalPremium = policies.reduce((sum, p) => sum + (p.premium ?? 0), 0);
  const totalCommission = policies.reduce((sum, p) => sum + (p.commissionAmount ?? 0), 0);
  const byProduct = new Map<string, number>();
  for (const p of policies) byProduct.set(p.product, (byProduct.get(p.product) ?? 0) + 1);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCard icon={FileCheck2} label="Pólizas vendidas" value={String(policies.length)} />
        <MetricCard icon={FileCheck2} label="Prima total" value={`USD ${totalPremium.toLocaleString("es-MX")}`} />
        <MetricCard icon={FileCheck2} label="Comisión total" value={`USD ${totalCommission.toLocaleString("es-MX")}`} />
      </div>

      {byProduct.size > 0 && (
        <Card>
          <CardHeader title="Por producto" />
          <div className="flex flex-wrap gap-2">
            {[...byProduct.entries()].map(([product, count]) => (
              <span key={product} className="rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-foreground">
                {product}: {count}
              </span>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Pólizas" />
        {policies.length === 0 ? (
          <EmptyState icon={FileCheck2} title="Sin pólizas" description="Todavía no hay pólizas vinculadas a este cliente." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs text-neutral-500">
                  <th className="pb-2 font-medium">Cliente final</th>
                  <th className="pb-2 font-medium">Producto</th>
                  <th className="pb-2 font-medium">Aseguradora</th>
                  <th className="pb-2 font-medium">Prima</th>
                  <th className="pb-2 font-medium">Fecha</th>
                  <th className="pb-2 font-medium">Estado</th>
                  <th className="pb-2 font-medium">Comisión</th>
                </tr>
              </thead>
              <tbody>
                {policies.map((p) => (
                  <tr key={p.id} className="border-t border-border-default">
                    <td className="py-2 text-foreground">{p.contactName ?? "—"}</td>
                    <td className="py-2 text-foreground">{p.product}</td>
                    <td className="py-2 text-neutral-500">{p.company}</td>
                    <td className="py-2 text-neutral-500">{p.premium ? `${p.premiumCurrency ?? "USD"} ${p.premium.toLocaleString("es-MX")}` : "—"}</td>
                    <td className="py-2 text-neutral-500">{formatDate(p.issueDate)}</td>
                    <td className="py-2 text-neutral-500">{STATUS_LABEL[p.status] ?? p.status}</td>
                    <td className="py-2 text-neutral-500">{p.commissionAmount ? `USD ${p.commissionAmount.toLocaleString("es-MX")}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
