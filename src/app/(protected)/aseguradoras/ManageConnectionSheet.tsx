"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { toast } from "@/components/toast/toast";
import { History, RefreshCw, Unplug, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { formatRelativeTime } from "@/lib/utils/format";
import { getInsuranceConnectionDetailAction, disconnectInsuranceProviderAction, type InsuranceConnectionDetail } from "@/lib/insuranceProviders/actions";
import type { InsuranceProviderCard } from "@/lib/insuranceProviders/queries";

const JOB_STATUS_ICON = { completed: CheckCircle2, failed: XCircle, processing: Loader2 } as const;
const JOB_STATUS_COLOR = { completed: "text-success-strong", failed: "text-error-strong", processing: "text-info-strong" } as const;

export function ManageConnectionSheet({
  provider,
  open,
  onClose,
  onResync,
  onDisconnected,
}: {
  provider: InsuranceProviderCard;
  open: boolean;
  onClose: () => void;
  onResync: () => void;
  onDisconnected: () => void;
}) {
  const [detail, setDetail] = useState<InsuranceConnectionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Se monta solo mientras `open` es true (AseguradorasShell renderiza este
  // componente condicionalmente) — cada apertura es una instancia nueva, así
  // que `loading` arranca en true por su valor inicial, sin necesidad de
  // setearlo síncronamente acá adentro.
  useEffect(() => {
    let cancelled = false;
    getInsuranceConnectionDetailAction(provider.id).then((res) => {
      if (cancelled) return;
      if ("error" in res) toast.error(res.error);
      else setDetail(res);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [provider.id]);

  async function handleDisconnect() {
    if (!provider.connectionId) return;
    setIsDisconnecting(true);
    try {
      await disconnectInsuranceProviderAction(provider.connectionId);
      toast.success(`${provider.name} desconectada.`);
      onDisconnected();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo desconectar.");
    } finally {
      setIsDisconnecting(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Administrar conexión — ${provider.name}`} className="max-w-lg">
      <div className="flex flex-col gap-5 p-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-surface-2 p-3">
            <p className="font-mono text-xl font-semibold text-foreground">{provider.policiesSynced}</p>
            <p className="text-xs text-neutral-500">Pólizas sincronizadas</p>
          </div>
          <div className="rounded-lg bg-surface-2 p-3">
            <p className="font-mono text-xl font-semibold text-foreground">{provider.clientsSynced}</p>
            <p className="text-xs text-neutral-500">Clientes sincronizados</p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border-default px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Método: Carga manual</p>
            <p className="text-xs text-neutral-500">{provider.lastSyncAt ? `Última sincronización ${formatRelativeTime(provider.lastSyncAt)}` : "Todavía sin sincronizar"}</p>
          </div>
          <Button size="sm" variant="secondary" onClick={onResync}>
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Sincronizar
          </Button>
        </div>

        {provider.lastError && (
          <p className="rounded-md bg-error-bg px-3 py-2 text-xs text-error-strong">{provider.lastError}</p>
        )}

        <div className="flex flex-col gap-2">
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            <History className="size-4 text-neutral-400" aria-hidden="true" />
            Historial de sincronizaciones
          </p>
          {loading ? (
            <div className="flex justify-center py-6">
              <Spinner />
            </div>
          ) : !detail || detail.jobs.length === 0 ? (
            <EmptyState icon={History} title="Sin sincronizaciones todavía" description="El historial va a aparecer acá después de la primera carga." />
          ) : (
            <ul className="flex flex-col divide-y divide-border-default">
              {detail.jobs.map((job) => {
                const Icon = JOB_STATUS_ICON[job.status];
                return (
                  <li key={job.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon className={`size-4 shrink-0 ${JOB_STATUS_COLOR[job.status]} ${job.status === "processing" ? "animate-spin" : ""}`} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="truncate text-sm text-foreground">{job.sourceFileName ?? "Sincronización"}</p>
                        <p className="text-xs text-neutral-500">
                          {job.policiesSyncedCount} póliza(s) · {job.triggeredByName ?? "—"}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-xs text-neutral-400">{formatRelativeTime(job.startedAt)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Button variant="destructive" onClick={handleDisconnect} loading={isDisconnecting}>
          <Unplug className="size-3.5" aria-hidden="true" />
          Desconectar aseguradora
        </Button>
      </div>
    </Sheet>
  );
}
