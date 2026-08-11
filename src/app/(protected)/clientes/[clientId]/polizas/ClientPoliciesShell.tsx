"use client";

import { useMemo, useState } from "react";
import { FileCheck2, DollarSign, TrendingUp, Search, Plus, CalendarClock } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { MetricCard } from "@/components/responseSummary/MetricCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PolicyFormSheet } from "@/app/(protected)/polizas/PolicyFormSheet";
import { POLICY_STAGES, POLICY_STATUS_BADGE_VARIANT, type PolicyStatus } from "@/lib/policies/constants";
import type { ClientPolicy, ClientPolicyPayment, ClientProfile } from "@/lib/clients/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { getClientPoliciesAction, getClientUpcomingPolicyPaymentsAction } from "@/lib/clients/actions";

const STATUS_LABEL: Record<string, string> = Object.fromEntries(POLICY_STAGES.map((s) => [s.key, s.name]));

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

export function ClientPoliciesShell({
  clientId,
  client,
  initialPolicies,
  upcomingPayments: initialUpcomingPayments,
  members,
}: {
  clientId: string;
  client: ClientProfile;
  initialPolicies: ClientPolicy[];
  upcomingPayments: ClientPolicyPayment[];
  members: WorkspaceMemberOption[];
}) {
  const [policies, setPolicies] = useState(initialPolicies);
  const [upcomingPayments, setUpcomingPayments] = useState(initialUpcomingPayments);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [creating, setCreating] = useState(false);

  async function refetch() {
    const [freshPolicies, freshPayments] = await Promise.all([getClientPoliciesAction(clientId), getClientUpcomingPolicyPaymentsAction(clientId)]);
    setPolicies(freshPolicies);
    setUpcomingPayments(freshPayments);
  }

  const totalPremium = policies.reduce((sum, p) => sum + (p.premium ?? 0), 0);
  const totalCommission = policies.reduce((sum, p) => sum + (p.commissionAmount ?? 0), 0);

  const byProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of policies) map.set(p.product, (map.get(p.product) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [policies]);

  const byStatus = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of policies) map.set(p.status, (map.get(p.status) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [policies]);

  const filteredQuery = search.trim().toLowerCase();
  const filtered = policies.filter((p) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (filteredQuery && !p.product.toLowerCase().includes(filteredQuery) && !p.company.toLowerCase().includes(filteredQuery) && !(p.policyNumber ?? "").toLowerCase().includes(filteredQuery))
      return false;
    return true;
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Nueva póliza
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCard icon={FileCheck2} label="Pólizas vendidas" value={String(policies.length)} />
        <MetricCard icon={DollarSign} label="Valor generado" value={`USD ${totalPremium.toLocaleString("es-MX")}`} />
        <MetricCard icon={TrendingUp} label="Comisión estimada" value={`USD ${totalCommission.toLocaleString("es-MX")}`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <div className="flex flex-wrap items-center gap-2 pb-3">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar pólizas…"
                className="w-full rounded-full border border-border-default bg-surface-1 py-2 pr-3 pl-9 text-sm text-foreground placeholder:text-neutral-400 outline-none focus:border-accent-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-full border border-border-default bg-surface-1 px-3.5 py-2 text-[13px] font-medium text-foreground outline-none focus:border-accent-500"
            >
              <option value="all">Todos los estados</option>
              {POLICY_STAGES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {policies.length === 0 ? (
            <EmptyState icon={FileCheck2} title="Sin pólizas" description="Todavía no hay pólizas vinculadas a este cliente." />
          ) : filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-neutral-500">Ninguna póliza coincide con la búsqueda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border-default text-xs text-neutral-500">
                    <th className="py-2 font-medium">N°</th>
                    <th className="py-2 font-medium">Producto</th>
                    <th className="py-2 font-medium">Aseguradora</th>
                    <th className="py-2 font-medium">Prima</th>
                    <th className="py-2 font-medium">Vencimiento</th>
                    <th className="py-2 font-medium">Estado</th>
                    <th className="py-2 font-medium">Comisión</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b border-border-default last:border-0">
                      <td className="py-2 text-neutral-500">{p.policyNumber ?? "—"}</td>
                      <td className="py-2 text-foreground">{p.product}</td>
                      <td className="py-2 text-neutral-500">{p.company}</td>
                      <td className="py-2 text-neutral-500">{p.premium ? `${p.premiumCurrency ?? "USD"} ${p.premium.toLocaleString("es-MX")}` : "—"}</td>
                      <td className="py-2 text-neutral-500">{formatDate(p.endDate)}</td>
                      <td className="py-2">
                        <Badge variant={POLICY_STATUS_BADGE_VARIANT[p.status as PolicyStatus] ?? "neutral"}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
                      </td>
                      <td className="py-2 text-neutral-500">{p.commissionAmount ? `USD ${p.commissionAmount.toLocaleString("es-MX")}` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          {byStatus.length > 0 && (
            <Card>
              <CardHeader title="Distribución por estado" />
              <div className="flex flex-col gap-2">
                {byStatus.map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between text-sm">
                    <Badge variant={POLICY_STATUS_BADGE_VARIANT[status as PolicyStatus] ?? "neutral"}>{STATUS_LABEL[status] ?? status}</Badge>
                    <span className="font-medium text-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {byProduct.length > 0 && (
            <Card>
              <CardHeader title="Por producto" />
              <div className="flex flex-col gap-2">
                {byProduct.map(([product, count]) => (
                  <div key={product} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{product}</span>
                    <span className="font-medium text-neutral-500">{count}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title="Próximos cierres" />
            {upcomingPayments.length === 0 ? (
              <p className="text-sm text-neutral-500">Sin cuotas pendientes.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {upcomingPayments.map((pay) => (
                  <li key={pay.id} className="flex items-center gap-2.5 text-sm">
                    <CalendarClock className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-foreground">{pay.policyProduct}</p>
                      <p className="text-xs text-neutral-500">{formatDate(pay.dueDate)}</p>
                    </div>
                    <span className="shrink-0 font-medium text-foreground">
                      {pay.currency} {pay.amount.toLocaleString("es-MX")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {creating && (
        <PolicyFormSheet
          policy={null}
          defaultContact={{ id: client.contactId, name: client.contactName, phone: client.contactPhone ?? undefined, email: client.contactEmail ?? undefined }}
          initialClientId={clientId}
          members={members}
          onClose={() => setCreating(false)}
          onSaved={refetch}
        />
      )}
    </div>
  );
}
