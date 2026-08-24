"use client";

import { useCallback, useEffect, useState, useTransition, type ComponentType } from "react";
import Link from "next/link";
import { Users, FileCheck2, DollarSign, CalendarClock, RefreshCw, Ban, Plug, Sparkles } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/toast/toast";
import { formatRelativeTime } from "@/lib/utils/format";
import type { CarteraSummary } from "@/lib/portfolioAgent/queries";
import { getInsuranceConnectionDetailAction } from "@/lib/insuranceProviders/actions";
import type { InsuranceProviderCard, InsuranceSyncJobEntry } from "@/lib/insuranceProviders/queries";
import { startPortalSyncAction, cancelPortalSyncAction } from "@/lib/portfolioAgent/actions";
import { PORTAL_SYNC_STEP_LABEL } from "@/lib/insuranceProviders/constants";

const POLL_INTERVAL_MS = 3000;
const ACTIVE_STATUSES = new Set(["queued", "starting", "authenticating", "navigating", "extracting", "normalizing", "syncing", "analyzing"]);

function StatTile({ icon: Icon, value, label }: { icon: ComponentType<{ className?: string }>; value: string; label: string }) {
  return (
    <Card className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
        <Icon className="size-[18px]" />
      </span>
      <div>
        <p className="font-mono text-xl font-semibold leading-none text-foreground">{value}</p>
        <p className="mt-1 text-[13px] text-neutral-500">{label}</p>
      </div>
    </Card>
  );
}

/** No usa Supabase Realtime para el progreso en vivo (a diferencia de las
 * sesiones de WhatsApp Web) — polling simple cada 3s mientras el job está
 * en un estado activo, suficiente latencia para una sincronización que
 * tarda al menos varios segundos por póliza. */
export function PortfolioAgentShell({ initialSummary, portalProvider }: { initialSummary: CarteraSummary; portalProvider: InsuranceProviderCard | null }) {
  const [summary] = useState(initialSummary);
  const [jobs, setJobs] = useState<InsuranceSyncJobEntry[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [, startTransition] = useTransition();

  const refreshJobs = useCallback(async () => {
    if (!portalProvider) return;
    const detail = await getInsuranceConnectionDetailAction(portalProvider.id);
    if (!("error" in detail)) setJobs(detail.jobs);
  }, [portalProvider]);

  useEffect(() => {
    startTransition(() => {
      refreshJobs();
    });
  }, [refreshJobs]);

  const latestJob = jobs[0] ?? null;
  const isActive = latestJob ? ACTIVE_STATUSES.has(latestJob.status) : false;

  useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(refreshJobs, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isActive, refreshJobs]);

  async function handleSync() {
    if (!portalProvider?.connectionId) return;
    setIsBusy(true);
    const result = await startPortalSyncAction(portalProvider.connectionId);
    setIsBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Sincronización iniciada.");
    await refreshJobs();
  }

  async function handleCancel() {
    if (!latestJob) return;
    setIsBusy(true);
    const result = await cancelPortalSyncAction(latestJob.id);
    setIsBusy(false);
    if (!result.ok) toast.error(result.error ?? "No se pudo cancelar.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={Users} value={String(summary.totalClients)} label="Clientes" />
        <StatTile icon={FileCheck2} value={String(summary.totalPolicies)} label="Pólizas" />
        <StatTile icon={DollarSign} value={summary.monthlyPremium.toLocaleString("es-MX", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} label="Prima mensual" />
        <StatTile icon={CalendarClock} value={String(summary.upcomingRenewals)} label="Renovaciones (30 días)" />
      </div>

      <Card>
        <CardHeader title="Portal conectado" />
        {!portalProvider ? (
          <EmptyState
            icon={Plug}
            title="Sin portal conectado"
            description="Conectá el portal de una aseguradora para que el Agente IA de Cartera empiece a sincronizar."
            action={
              <Link href="/aseguradoras" className="text-sm font-medium text-accent-600 hover:underline">
                Ir a Aseguradoras →
              </Link>
            }
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{portalProvider.name}</p>
                <p className="text-xs text-neutral-500">{portalProvider.lastSyncAt ? `Última sincronización ${formatRelativeTime(portalProvider.lastSyncAt)}` : "Todavía sin sincronizar"}</p>
              </div>
              {isActive ? (
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isBusy}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-error-strong/30 px-3.5 py-2 text-[13px] font-medium text-error-strong hover:bg-error-bg disabled:opacity-50"
                >
                  <Ban className="size-3.5" aria-hidden="true" />
                  Cancelar sincronización
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={isBusy}
                  className="flex shrink-0 items-center gap-1.5 rounded-full border border-border-default px-3.5 py-2 text-[13px] font-medium text-foreground hover:bg-surface-2 disabled:opacity-50"
                >
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                  Sincronizar ahora
                </button>
              )}
            </div>

            {latestJob && (
              <div className="rounded-lg bg-surface-2 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{PORTAL_SYNC_STEP_LABEL[latestJob.status]}</span>
                  {latestJob.processedCount !== null && <span className="text-neutral-500">{latestJob.processedCount}{latestJob.totalCount ? `/${latestJob.totalCount}` : ""} pólizas</span>}
                </div>
                {isActive && latestJob.processedCount !== null && latestJob.totalCount ? (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <div className="h-full rounded-full bg-accent-500 transition-all" style={{ width: `${Math.min(100, (latestJob.processedCount / latestJob.totalCount) * 100)}%` }} />
                  </div>
                ) : null}
                {latestJob.error && <p className="mt-2 text-xs text-error-strong">{latestJob.error}</p>}
              </div>
            )}
          </div>
        )}
      </Card>

      <Card>
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="size-4 text-accent-600" aria-hidden="true" />
          <h3 className="text-[15px] font-medium text-foreground">Oportunidades detectadas</h3>
        </div>
        <p className="text-sm text-neutral-500">
          El análisis de oportunidades (renovaciones, venta cruzada, clientes en riesgo) todavía no está construido — es la siguiente pasada de este feature, sobre los mismos datos que ya se están sincronizando acá.
        </p>
      </Card>
    </div>
  );
}
