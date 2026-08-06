"use client";

import { CheckCircle2, AlertTriangle, Plug, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatRelativeTime } from "@/lib/utils/format";
import type { InsuranceProviderCard as ProviderCardData } from "@/lib/insuranceProviders/queries";

const STATUS_BADGE: Record<ProviderCardData["status"], { label: string; variant: "success" | "error" | "neutral"; icon: typeof CheckCircle2 }> = {
  connected: { label: "Conectado", variant: "success", icon: CheckCircle2 },
  error: { label: "Error de sincronización", variant: "error", icon: AlertTriangle },
  not_connected: { label: "No conectado", variant: "neutral", icon: Plug },
};

export function ProviderCard({ provider, onClick }: { provider: ProviderCardData; onClick: () => void }) {
  const statusInfo = STATUS_BADGE[provider.status];
  const StatusIcon = statusInfo.icon;
  const initials = provider.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <button type="button" onClick={onClick} className="text-left">
      <Card className="flex h-full flex-col gap-4 transition-all duration-150 ease-out hover:shadow-[var(--elevation-md)]">
        <div className="flex items-center justify-between gap-2">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: provider.brandColor }}
          >
            {initials}
          </span>
          <Badge variant={statusInfo.variant} dot>
            <StatusIcon className="size-3" aria-hidden="true" />
            {statusInfo.label}
          </Badge>
        </div>

        <div>
          <p className="text-sm font-semibold text-foreground">{provider.name}</p>
          {provider.status === "connected" ? (
            <p className="mt-0.5 text-[13px] text-neutral-500">
              {provider.policiesSynced} póliza{provider.policiesSynced === 1 ? "" : "s"} · {provider.clientsSynced} cliente{provider.clientsSynced === 1 ? "" : "s"}
            </p>
          ) : (
            <p className="mt-0.5 text-[13px] text-neutral-500">Sin sincronizar</p>
          )}
        </div>

        {provider.status === "connected" && provider.lastSyncAt && (
          <p className="mt-auto flex items-center gap-1 text-xs text-neutral-400">
            <Clock className="size-3" aria-hidden="true" />
            Última sync {formatRelativeTime(provider.lastSyncAt)}
          </p>
        )}
        {provider.status !== "connected" && <p className="mt-auto text-xs font-medium text-accent-600">Conectar →</p>}
      </Card>
    </button>
  );
}
