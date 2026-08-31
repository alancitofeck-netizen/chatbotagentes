"use client";

import { useCallback, useEffect, useState, useTransition, type ComponentType } from "react";
import Link from "next/link";
import {
  Users,
  FileCheck2,
  DollarSign,
  CalendarClock,
  Target,
  RefreshCw,
  Ban,
  Plug,
  Sparkles,
  Settings,
  FolderOpen,
  CheckCircle2,
  Circle,
  Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/toast/toast";
import { formatRelativeTime } from "@/lib/utils/format";
import type { CarteraSummary, CarteraDetailSummary } from "@/lib/portfolioAgent/queries";
import { getInsuranceConnectionDetailAction } from "@/lib/insuranceProviders/actions";
import type { InsuranceProviderCard, InsuranceSyncJobEntry } from "@/lib/insuranceProviders/queries";
import { startPortalSyncAction, cancelPortalSyncAction } from "@/lib/portfolioAgent/actions";
import { PORTAL_SYNC_STEP_LABEL } from "@/lib/insuranceProviders/constants";
import { useAutoStartTour } from "@/components/onboarding/useAutoStartTour";

const POLL_INTERVAL_MS = 3000;
const SYNC_STEPS = ["starting", "authenticating", "navigating", "extracting", "normalizing", "syncing"] as const;
const ACTIVE_STATUSES = new Set<string>(SYNC_STEPS);

function money(value: number) {
  return value.toLocaleString("es-MX", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function StatTile({ icon: Icon, value, label, sublabel }: { icon: ComponentType<{ className?: string }>; value: string; label: string; sublabel?: string }) {
  return (
    <Card className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0">
        <p className="font-mono text-xl font-semibold leading-none text-foreground">{value}</p>
        <p className="mt-1 truncate text-[13px] text-neutral-500">{label}</p>
        {sublabel && <p className="text-xs text-accent-600">{sublabel}</p>}
      </div>
    </Card>
  );
}

/** Checklist de pasos del job actual — cada paso ya pasado se marca ✓, el
 * paso actual gira, los siguientes quedan grises. No inventa pasos que no
 * pasaron: si el job todavía no arrancó, ningún paso tiene check. */
function SyncChecklist({ currentStatus }: { currentStatus: string | null }) {
  const currentIndex = currentStatus ? SYNC_STEPS.indexOf(currentStatus as (typeof SYNC_STEPS)[number]) : -1;
  return (
    <ul className="flex flex-col gap-2">
      {SYNC_STEPS.map((step, i) => {
        const done = currentIndex > i || currentStatus === "completed";
        const active = i === currentIndex;
        return (
          <li key={step} className="flex items-center gap-2 text-[13px]">
            {done ? (
              <CheckCircle2 className="size-4 shrink-0 text-success-strong" aria-hidden="true" />
            ) : active ? (
              <Loader2 className="size-4 shrink-0 animate-spin text-accent-600" aria-hidden="true" />
            ) : (
              <Circle className="size-4 shrink-0 text-neutral-300" aria-hidden="true" />
            )}
            <span className={done || active ? "text-foreground" : "text-neutral-400"}>{PORTAL_SYNC_STEP_LABEL[step]}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** No usa Supabase Realtime para el progreso en vivo (a diferencia de las
 * sesiones de WhatsApp Web) — polling simple cada 3s mientras el job está
 * en un estado activo, suficiente latencia para una sincronización que
 * tarda al menos varios segundos por póliza.
 *
 * "Oportunidades detectadas" y "Mensaje sugerido por IA" del mockup
 * original quedan como próximamente honesto (sin datos/mensajes
 * inventados) — necesitan el motor de scoring/generación de la siguiente
 * pasada, no son solo un tema visual. */
export function PortfolioAgentShell({
  initialSummary,
  detailSummary,
  portalProvider,
}: {
  initialSummary: CarteraSummary;
  detailSummary: CarteraDetailSummary;
  portalProvider: InsuranceProviderCard | null;
}) {
  useAutoStartTour("portfolio-agent-intro");
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
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile icon={Users} value={String(summary.totalClients)} label="Clientes" />
        <StatTile icon={FileCheck2} value={String(summary.totalPolicies)} label="Pólizas" />
        <StatTile icon={DollarSign} value={money(summary.monthlyPremium)} label="Prima mensual" />
        <StatTile icon={CalendarClock} value={String(summary.upcomingRenewals)} label="Renovaciones" sublabel="Próximos 30 días" />
        <StatTile icon={Target} value="—" label="Oportunidades" sublabel="Próximamente" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex flex-col gap-4">
          {!portalProvider ? (
            <Card>
              <EmptyState
                icon={Plug}
                title="Sin portal conectado"
                description="Conectá el portal de una aseguradora para que el Agente IA de Cartera empiece a sincronizar."
                action={
                  <Link href="/aseguradoras" data-tour="portfolio-agent.connect-empty-link" className="text-sm font-medium text-accent-600 hover:underline">
                    Ir a Aseguradoras →
                  </Link>
                }
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_260px]">
              <Card className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[15px] font-medium text-foreground">{isActive ? "Sincronización en progreso" : "Sincronización"}</h3>
                    <Badge variant="accent">{portalProvider.name}</Badge>
                  </div>
                  {isActive ? (
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={isBusy}
                      className="flex shrink-0 items-center gap-1.5 rounded-full border border-error-strong/30 px-3.5 py-2 text-[13px] font-medium text-error-strong hover:bg-error-bg disabled:opacity-50"
                    >
                      <Ban className="size-3.5" aria-hidden="true" />
                      Cancelar
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-tour="portfolio-agent.sync-button"
                      onClick={handleSync}
                      disabled={isBusy}
                      className="flex shrink-0 items-center gap-1.5 rounded-full border border-border-default px-3.5 py-2 text-[13px] font-medium text-foreground hover:bg-surface-2 disabled:opacity-50"
                    >
                      <RefreshCw className="size-3.5" aria-hidden="true" />
                      Sincronizar ahora
                    </button>
                  )}
                </div>

                {latestJob ? (
                  <>
                    <SyncChecklist currentStatus={latestJob.status} />
                    {latestJob.processedCount !== null && (
                      <div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-neutral-500">Pólizas encontradas</span>
                          <span className="font-mono font-medium text-foreground">
                            {latestJob.processedCount}
                            {latestJob.totalCount ? ` / ${latestJob.totalCount}` : ""}
                          </span>
                        </div>
                        {latestJob.totalCount ? (
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                            <div
                              className="h-full rounded-full bg-accent-500 transition-all"
                              style={{ width: `${Math.min(100, (latestJob.processedCount / latestJob.totalCount) * 100)}%` }}
                            />
                          </div>
                        ) : null}
                      </div>
                    )}
                    {latestJob.error && <p className="text-xs text-error-strong">{latestJob.error}</p>}
                  </>
                ) : (
                  <p className="text-sm text-neutral-500">Todavía no corriste ninguna sincronización con este portal.</p>
                )}
              </Card>

              <Card className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[15px] font-medium text-foreground">Última sincronización</h3>
                  {latestJob && !isActive && (
                    <Badge variant={latestJob.status === "completed" ? "success" : latestJob.status === "failed" ? "error" : "warning"}>
                      {PORTAL_SYNC_STEP_LABEL[latestJob.status]}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-neutral-500">{portalProvider.lastSyncAt ? formatRelativeTime(portalProvider.lastSyncAt) : "Todavía sin sincronizar"}</p>
                {latestJob && !isActive ? (
                  <ul className="flex flex-col gap-1.5 text-sm">
                    <li className="flex items-center justify-between">
                      <span className="text-neutral-500">Procesadas</span>
                      <span className="font-medium text-foreground">{latestJob.policiesSyncedCount}</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-neutral-500">Nuevas</span>
                      <span className="font-medium text-success-strong">{latestJob.createdCount ?? 0}</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="text-neutral-500">Actualizadas</span>
                      <span className="font-medium text-info-strong">{latestJob.updatedCount ?? 0}</span>
                    </li>
                  </ul>
                ) : (
                  !isActive && <p className="text-sm text-neutral-500">Sin datos todavía.</p>
                )}
              </Card>
            </div>
          )}

          <Card>
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="size-4 text-accent-600" aria-hidden="true" />
              <h3 className="text-[15px] font-medium text-foreground">Oportunidades detectadas</h3>
            </div>
            <p className="text-sm text-neutral-500">
              El análisis de oportunidades (renovaciones, venta cruzada, clientes en riesgo) todavía no está construido — es la siguiente pasada de este feature, sobre los mismos datos que ya se están sincronizando acá.
            </p>
          </Card>

          <Card>
            <h3 className="mb-4 text-[15px] font-medium text-foreground">Resumen de la cartera</h3>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <p className="font-mono text-xl font-semibold text-foreground">{detailSummary.activePolicies}</p>
                <p className="text-xs text-neutral-500">Pólizas activas</p>
                <p className="text-xs text-success-strong">{detailSummary.activePolicyPct}%</p>
              </div>
              <div>
                <p className="font-mono text-xl font-semibold text-foreground">{detailSummary.cancelledPolicies}</p>
                <p className="text-xs text-neutral-500">Pólizas canceladas</p>
                <p className="text-xs text-error-strong">{detailSummary.cancelledPolicyPct}%</p>
              </div>
              <div>
                <p className="font-mono text-xl font-semibold text-foreground">{money(detailSummary.averageMonthlyPremium)}</p>
                <p className="text-xs text-neutral-500">Prima promedio (mensual)</p>
              </div>
              <div>
                <p className="font-mono text-xl font-semibold text-foreground">{money(detailSummary.annualPortfolioValue)}</p>
                <p className="text-xs text-neutral-500">Valor de cartera</p>
                <p className="text-xs text-neutral-400">Anualizado</p>
              </div>
              <div>
                <p className="font-mono text-xl font-semibold text-foreground">{detailSummary.connectedInsurers}</p>
                <p className="text-xs text-neutral-500">Aseguradoras conectadas</p>
              </div>
              <div>
                <p className="font-mono text-xl font-semibold text-foreground">{detailSummary.distinctProducts}</p>
                <p className="text-xs text-neutral-500">Productos en cartera</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-medium text-foreground">Portal conectado</h3>
              {portalProvider && (
                <Link href="/aseguradoras" aria-label="Configuración" className="text-neutral-400 hover:text-foreground">
                  <Settings className="size-4" aria-hidden="true" />
                </Link>
              )}
            </div>
            {!portalProvider ? (
              <p className="text-sm text-neutral-500">Ninguno todavía.</p>
            ) : (
              <>
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white" style={{ backgroundColor: portalProvider.brandColor }}>
                    {portalProvider.name.slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{portalProvider.name}</p>
                    <Badge variant={portalProvider.status === "connected" ? "success" : "error"} dot>
                      {portalProvider.status === "connected" ? "Conectado" : "Error"}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-neutral-500">{portalProvider.lastSyncAt ? `Última sincronización ${formatRelativeTime(portalProvider.lastSyncAt)}` : "Sin sincronizar todavía"}</p>
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={isBusy || isActive}
                  className="flex items-center justify-center gap-1.5 rounded-full bg-accent-500 px-3.5 py-2 text-[13px] font-medium text-white hover:bg-accent-600 disabled:opacity-50"
                >
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                  Sincronizar ahora
                </button>
                <Link
                  href="/aseguradoras"
                  className="flex items-center justify-center gap-1.5 rounded-full border border-border-default px-3.5 py-2 text-[13px] font-medium text-foreground hover:bg-surface-2"
                >
                  <Settings className="size-3.5" aria-hidden="true" />
                  Configuración
                </Link>
              </>
            )}
          </Card>

          <Card className="flex flex-col gap-2">
            <h3 className="mb-1 text-[15px] font-medium text-foreground">Acciones rápidas</h3>
            <Link href="/polizas" className="flex items-center gap-2 rounded-md px-2 py-2 text-[13px] text-foreground hover:bg-surface-2">
              <FolderOpen className="size-4 text-neutral-400" aria-hidden="true" />
              Ver cartera completa
            </Link>
            <Link href="/aseguradoras" className="flex items-center gap-2 rounded-md px-2 py-2 text-[13px] text-foreground hover:bg-surface-2">
              <Plug className="size-4 text-neutral-400" aria-hidden="true" />
              Gestionar conexiones
            </Link>
          </Card>

          <Card>
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="size-4 text-accent-600" aria-hidden="true" />
              <h3 className="text-[15px] font-medium text-foreground">Mensaje sugerido por IA</h3>
            </div>
            <p className="text-sm text-neutral-500">Próximamente — se va a generar sobre las oportunidades detectadas, todavía no construidas.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
