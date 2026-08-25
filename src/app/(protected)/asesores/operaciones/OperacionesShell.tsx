"use client";

import { useMemo, useState } from "react";
import { ShieldCheck, Wallet, Landmark, CalendarClock, Clock, AlertTriangle, ClipboardList, FileWarning, Search, Activity as ActivityIcon, PieChart as PieChartIcon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer, Cell, Pie, PieChart } from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatCurrency, formatRelativeTime } from "@/lib/utils/format";
import { POLICY_STAGES, POLICY_STATUS_BADGE_VARIANT, ACTIVE_LIKE_STATUSES } from "@/lib/policies/constants";
import { COLLECTION_BUCKET_LABEL, COLLECTION_BUCKET_VARIANT, deriveCollectionBucket } from "@/lib/collections/constants";
import type { AgencyAdvisorOption } from "@/lib/kpis/agencyPerformance";
import type { AgencyPolicyRow, AgencyPolicyPaymentRow, AgencyOperationalTask, AgencyPendingDocPolicy, AgencyActivityEvent } from "@/lib/kpis/agencyOperations";
import { deriveAgencyPolicyFunnel, deriveAgencyTopProducts, annualizedPremium } from "@/lib/kpis/agencyOperationsDerive";
import { StatTile } from "../StatTile";
import { PolicyDetailDrawer } from "./PolicyDetailDrawer";

const CHART_TOOLTIP_STYLE = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-default)",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "var(--elevation-md)",
};

const DONUT_PALETTE = ["var(--color-accent-500)", "var(--color-chart-2)", "var(--color-chart-1)", "var(--color-chart-3)", "var(--color-chart-4)", "var(--color-chart-5)"];

const TASK_STATUS_LABEL: Record<string, string> = { pending: "Pendiente", in_progress: "En progreso", completed: "Completada" };
const TASK_PRIORITY_LABEL: Record<string, string> = { low: "Baja", medium: "Media", high: "Alta", urgent: "Urgente" };
const TASK_PRIORITY_VARIANT: Record<string, "neutral" | "info" | "warning" | "error"> = { low: "neutral", medium: "info", high: "warning", urgent: "error" };

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function humanizeAction(action: string): string {
  const s = action.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabelShort(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("es", { month: "short", year: "2-digit", timeZone: "UTC" });
}

/** Últimos 6 meses (incluido el actual), ISO "YYYY-MM", más viejo primero. */
function lastSixMonthKeys(): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

/** Asesores → Operaciones: vista cross-asesor de pólizas/pagos/tareas/
 * documentación/actividad de TODA la agencia — análoga a Performance/
 * Agendas. El filtro "Asesor" acota TODA la página (KPIs, funnel,
 * evolución, top productos, pagos, tareas, documentación, actividad);
 * "Estado" y la búsqueda solo acotan la tabla de Pólizas recientes, mismo
 * criterio de "filtro de foco + filtro de tabla" ya usado en Agendas
 * (advisorFilter allí también recorta todo, setter/estado solo la tabla). */
export function OperacionesShell({
  advisors,
  policies,
  payments,
  tasks,
  pendingDocs,
  activity,
}: {
  advisors: AgencyAdvisorOption[];
  policies: AgencyPolicyRow[];
  payments: AgencyPolicyPaymentRow[];
  tasks: AgencyOperationalTask[];
  pendingDocs: AgencyPendingDocPolicy[];
  activity: AgencyActivityEvent[];
}) {
  const [advisorFilter, setAdvisorFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedPolicy, setSelectedPolicy] = useState<AgencyPolicyRow | null>(null);
  const nowMs = new Date().getTime();

  const scopedPolicies = useMemo(() => (advisorFilter ? policies.filter((p) => p.advisorWorkspaceId === advisorFilter) : policies), [policies, advisorFilter]);
  const scopedPayments = useMemo(() => (advisorFilter ? payments.filter((p) => p.advisorWorkspaceId === advisorFilter) : payments), [payments, advisorFilter]);
  const scopedTasks = useMemo(() => (advisorFilter ? tasks.filter((t) => t.advisorWorkspaceId === advisorFilter) : tasks), [tasks, advisorFilter]);
  const scopedPendingDocs = useMemo(() => (advisorFilter ? pendingDocs.filter((d) => d.advisorWorkspaceId === advisorFilter) : pendingDocs), [pendingDocs, advisorFilter]);
  const scopedActivity = useMemo(() => (advisorFilter ? activity.filter((a) => a.advisorWorkspaceId === advisorFilter) : activity), [activity, advisorFilter]);

  const tablePolicies = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedPolicies.filter(
      (p) =>
        (!statusFilter || p.status === statusFilter) &&
        (!q || [p.contactName, p.policyNumber, p.product, p.company, p.advisorName].some((v) => v?.toLowerCase().includes(q))),
    );
  }, [scopedPolicies, statusFilter, search]);

  // --- KPIs (8 tiles) ---------------------------------------------------
  const activePolicies = useMemo(() => scopedPolicies.filter((p) => ACTIVE_LIKE_STATUSES.includes(p.status)).length, [scopedPolicies]);
  const annualValue = useMemo(() => annualizedPremium(scopedPolicies), [scopedPolicies]);
  const totalCommission = useMemo(
    () => scopedPolicies.filter((p) => ACTIVE_LIKE_STATUSES.includes(p.status)).reduce((sum, p) => sum + (p.commissionAmount ?? 0), 0),
    [scopedPolicies],
  );
  const upcomingRenewals = useMemo(() => {
    const in30 = nowMs + 30 * 24 * 60 * 60 * 1000;
    return scopedPolicies.filter((p) => {
      const dateStr = p.renewalDate ?? p.endDate;
      if (!dateStr) return false;
      const t = new Date(dateStr).getTime();
      return t >= nowMs && t <= in30;
    }).length;
  }, [scopedPolicies, nowMs]);
  const paymentsPending = useMemo(() => scopedPayments.filter((p) => p.status === "pendiente" || p.status === "en_seguimiento").length, [scopedPayments]);
  const paymentsOverdue = useMemo(() => scopedPayments.filter((p) => deriveCollectionBucket(p.status, p.dueDate) === "vencido").length, [scopedPayments]);
  const openTasks = useMemo(() => scopedTasks.filter((t) => t.status !== "completed").length, [scopedTasks]);
  const pendingDocsCount = scopedPendingDocs.length;

  // --- Conversión / evolución / top productos ---------------------------
  const funnel = useMemo(() => deriveAgencyPolicyFunnel(scopedPolicies), [scopedPolicies]);
  const funnelMax = Math.max(1, ...funnel.map((s) => s.count));
  const wonCount = activePolicies;
  const lostCount = useMemo(() => scopedPolicies.filter((p) => p.status === "cancelada" || p.status === "vencida").length, [scopedPolicies]);
  const conversionRate = wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 1000) / 10 : 0;

  const monthlyEvolution = useMemo(() => {
    const months = lastSixMonthKeys();
    const buckets = new Map(months.map((m) => [m, { total: 0, converted: 0 }]));
    for (const p of scopedPolicies) {
      const key = monthKey(p.issueDate ?? p.createdAt);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      bucket.total += 1;
      if (ACTIVE_LIKE_STATUSES.includes(p.status)) bucket.converted += 1;
    }
    return months.map((m) => ({ month: monthLabelShort(m), total: buckets.get(m)!.total, converted: buckets.get(m)!.converted }));
  }, [scopedPolicies]);

  const topProducts = useMemo(() => deriveAgencyTopProducts(scopedPolicies), [scopedPolicies]);

  const noData = policies.length === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <Select label="Asesor" value={advisorFilter} onChange={(e) => setAdvisorFilter(e.target.value)} containerClassName="w-auto">
          <option value="">Todos</option>
          {advisors.map((a) => (
            <option key={a.workspaceId} value={a.workspaceId}>
              {a.name}
            </option>
          ))}
        </Select>

        <Select label="Estado de póliza" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} containerClassName="w-auto">
          <option value="">Todos</option>
          {POLICY_STAGES.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </Select>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Buscar</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" aria-hidden="true" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cliente, póliza, producto..."
              className="w-64 rounded-sm border border-border-strong bg-surface-1 py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
            />
          </div>
        </div>
      </div>

      {noData ? (
        <EmptyState icon={ShieldCheck} title="Sin pólizas todavía" description="Ningún asesor tiene pólizas cargadas todavía." />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile icon={ShieldCheck} label="Pólizas activas" value={String(activePolicies)} />
            <StatTile icon={Landmark} label="Valor de cartera anualizado" value={formatCurrency(annualValue)} />
            <StatTile icon={Wallet} label="Comisión total (activas)" value={formatCurrency(totalCommission)} />
            <StatTile icon={CalendarClock} label="Renovaciones próximas (30d)" value={String(upcomingRenewals)} />
            <StatTile icon={Clock} label="Pagos pendientes" value={String(paymentsPending)} />
            <StatTile icon={AlertTriangle} label="Pagos vencidos" value={String(paymentsOverdue)} color="var(--color-error-strong)" />
            <StatTile icon={ClipboardList} label="Tareas operativas abiertas" value={String(openTasks)} />
            <StatTile icon={FileWarning} label="Documentación pendiente" value={String(pendingDocsCount)} color="var(--color-warning-strong)" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card>
              <CardHeader title="Pólizas recientes" action={<span className="text-xs text-neutral-500">{tablePolicies.length} de {scopedPolicies.length}</span>} />
              {tablePolicies.length === 0 ? (
                <p className="text-sm text-neutral-500">Sin pólizas para este filtro.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-border-default text-xs text-neutral-500">
                        <th className="pb-2 pr-3 font-medium">Cliente</th>
                        <th className="pb-2 pr-3 font-medium">Asesor</th>
                        <th className="pb-2 pr-3 font-medium">Aseguradora / Producto</th>
                        <th className="pb-2 pr-3 font-medium">Estado</th>
                        <th className="pb-2 pr-3 font-medium">Prima</th>
                        <th className="pb-2 font-medium">Vencimiento</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tablePolicies.slice(0, 30).map((p) => (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedPolicy(p)}
                          className="cursor-pointer border-b border-border-default last:border-0 hover:bg-surface-2"
                        >
                          <td className="py-2.5 pr-3 font-medium text-foreground">{p.contactName ?? "Sin cliente"}</td>
                          <td className="py-2.5 pr-3 text-neutral-500">{p.advisorName}</td>
                          <td className="py-2.5 pr-3 text-neutral-500">
                            {p.company} · {p.product}
                          </td>
                          <td className="py-2.5 pr-3">
                            <Badge variant={POLICY_STATUS_BADGE_VARIANT[p.status]}>{POLICY_STAGES.find((s) => s.key === p.status)?.name ?? p.status}</Badge>
                          </td>
                          <td className="py-2.5 pr-3 font-mono text-foreground">{p.premium !== null ? formatCurrency(p.premium, p.premiumCurrency ?? "USD") : "—"}</td>
                          <td className="py-2.5 text-neutral-500">{fmtDate(p.endDate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader title="Documentación pendiente" />
                {scopedPendingDocs.length === 0 ? (
                  <p className="text-sm text-neutral-500">Ninguna póliza en etapa temprana sin documentación cargada.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border-default">
                    {scopedPendingDocs.slice(0, 8).map((d) => (
                      <li key={d.policyId} className="flex flex-col gap-0.5 py-2 text-[13px]">
                        <span className="font-medium text-foreground">{d.contactName ?? "Sin cliente"} · {d.product}</span>
                        <span className="text-neutral-500">
                          {d.advisorName} — {POLICY_STAGES.find((s) => s.key === d.status)?.name ?? d.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {scopedPendingDocs.length > 8 && <p className="mt-2 text-xs text-neutral-500">+{scopedPendingDocs.length - 8} más.</p>}
              </Card>

              <Card>
                <CardHeader title="Actividad reciente" />
                {scopedActivity.length === 0 ? (
                  <p className="text-sm text-neutral-500">Sin actividad registrada todavía.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-border-default">
                    {scopedActivity.slice(0, 10).map((a) => (
                      <li key={a.id} className="flex items-start gap-2 py-2 text-[13px]">
                        <ActivityIcon className="mt-0.5 size-3.5 shrink-0 text-neutral-400" aria-hidden="true" />
                        <div>
                          <p className="text-foreground">
                            {humanizeAction(a.action)} <span className="text-neutral-500">· {a.advisorName}</span>
                          </p>
                          <p className="text-xs text-neutral-500">{formatRelativeTime(a.createdAt)}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          <Card>
            <CardHeader title="Pagos y comisiones" action={<span className="text-xs text-neutral-500">{scopedPayments.length} cuotas</span>} />
            {scopedPayments.length === 0 ? (
              <p className="text-sm text-neutral-500">Sin cronogramas de pago cargados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-border-default text-xs text-neutral-500">
                      <th className="pb-2 pr-3 font-medium">Cliente</th>
                      <th className="pb-2 pr-3 font-medium">Póliza</th>
                      <th className="pb-2 pr-3 font-medium">Asesor</th>
                      <th className="pb-2 pr-3 font-medium">Vencimiento</th>
                      <th className="pb-2 pr-3 font-medium">Monto</th>
                      <th className="pb-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scopedPayments.slice(0, 30).map((p) => {
                      const bucket = deriveCollectionBucket(p.status, p.dueDate);
                      return (
                        <tr key={p.id} className="border-b border-border-default last:border-0">
                          <td className="py-2.5 pr-3 font-medium text-foreground">{p.contactName ?? "Sin cliente"}</td>
                          <td className="py-2.5 pr-3 text-neutral-500">{p.policyProduct}</td>
                          <td className="py-2.5 pr-3 text-neutral-500">{p.advisorName}</td>
                          <td className="py-2.5 pr-3 text-neutral-500">{fmtDate(p.dueDate)}</td>
                          <td className="py-2.5 pr-3 font-mono text-foreground">{formatCurrency(p.amount, p.currency)}</td>
                          <td className="py-2.5">
                            <Badge variant={COLLECTION_BUCKET_VARIANT[bucket]}>{COLLECTION_BUCKET_LABEL[bucket]}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Tareas operativas" action={<span className="text-xs text-neutral-500">{openTasks} abiertas de {scopedTasks.length}</span>} />
            {scopedTasks.length === 0 ? (
              <p className="text-sm text-neutral-500">Sin tareas cargadas sobre asesores todavía.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-border-default">
                {scopedTasks.slice(0, 15).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{t.title}</p>
                      <p className="text-xs text-neutral-500">
                        {t.advisorName}
                        {t.relatedArea ? ` · ${t.relatedArea}` : ""}
                        {t.dueAt ? ` · vence ${fmtDate(t.dueAt)}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge variant={TASK_PRIORITY_VARIANT[t.priority] ?? "neutral"}>{TASK_PRIORITY_LABEL[t.priority] ?? t.priority}</Badge>
                      <Badge variant={t.status === "completed" ? "success" : "neutral"}>{TASK_STATUS_LABEL[t.status] ?? t.status}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader title="Conversión" action={<span className="text-xs text-neutral-500">{conversionRate}% tasa</span>} />
              <ul className="flex flex-col gap-2.5">
                {funnel
                  .filter((s) => s.count > 0)
                  .map((s) => (
                    <li key={s.stageKey} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[13px]">
                        <span className="text-foreground">{s.stageName}</span>
                        <span className="font-mono text-neutral-500">{s.count}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                        <div className="h-full rounded-full bg-accent-500" style={{ width: `${(s.count / funnelMax) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                {funnel.every((s) => s.count === 0) && <p className="text-sm text-neutral-500">Sin datos para este filtro.</p>}
              </ul>
            </Card>

            <Card>
              <CardHeader title="Evolución de conversiones" />
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyEvolution} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="var(--border-default)" />
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--color-neutral-500)" }} width={32} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Bar dataKey="total" name="Pólizas cargadas" fill="var(--color-chart-2)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="converted" name="Activas hoy" fill="var(--color-accent-500)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-xs text-neutral-500">Por mes de alta — &quot;Activas hoy&quot; cuenta las que siguen en un estado activo/renovado al día de hoy.</p>
            </Card>

            <Card>
              <CardHeader title="Top productos" />
              {topProducts.length === 0 ? (
                <EmptyState icon={PieChartIcon} title="Sin datos todavía" description="Ningún producto cargado para este filtro." />
              ) : (
                <>
                  <div className="relative h-[160px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={topProducts} dataKey="count" nameKey="product" innerRadius={48} outerRadius={70} paddingAngle={2} strokeWidth={0}>
                          {topProducts.map((s, i) => (
                            <Cell key={s.product} fill={DONUT_PALETTE[i % DONUT_PALETTE.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-mono text-xl font-semibold text-foreground">{scopedPolicies.length}</span>
                      <span className="text-xs text-neutral-500">Pólizas</span>
                    </div>
                  </div>
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {topProducts.map((s, i) => (
                      <li key={s.product} className="flex items-center justify-between gap-2 text-[13px]">
                        <span className="flex items-center gap-2 truncate text-neutral-500">
                          <span className="size-2 shrink-0 rounded-full" style={{ background: DONUT_PALETTE[i % DONUT_PALETTE.length] }} aria-hidden="true" />
                          <span className="truncate">{s.product}</span>
                        </span>
                        <span className="shrink-0 font-mono text-foreground">{s.count}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          </div>
        </>
      )}

      {selectedPolicy && <PolicyDetailDrawer policy={selectedPolicy} payments={payments} onClose={() => setSelectedPolicy(null)} />}
    </div>
  );
}
