"use client";

import { useState } from "react";
import { Plug, FileCheck2, Users, Clock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatRelativeTime } from "@/lib/utils/format";
import { getInsuranceProvidersBoardAction } from "@/lib/insuranceProviders/actions";
import type { InsuranceProviderCard as ProviderCardData, InsuranceProvidersSummary } from "@/lib/insuranceProviders/queries";
import { ProviderCard } from "./ProviderCard";
import { ConnectProviderModal } from "./ConnectProviderModal";
import { ManageConnectionSheet } from "./ManageConnectionSheet";
import { useAutoStartTour } from "@/components/onboarding/useAutoStartTour";

function SummaryTile({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">{icon}</span>
      <div>
        <p className="font-mono text-xl font-semibold leading-none text-foreground">{value}</p>
        <p className="mt-1 text-[13px] text-neutral-500">{label}</p>
      </div>
    </div>
  );
}

export function AseguradorasShell({
  initialProviders,
  initialSummary,
}: {
  initialProviders: ProviderCardData[];
  initialSummary: InsuranceProvidersSummary;
}) {
  useAutoStartTour("providers-intro");
  const [providers, setProviders] = useState(initialProviders);
  const [summary, setSummary] = useState(initialSummary);
  const [connectTarget, setConnectTarget] = useState<ProviderCardData | null>(null);
  const [manageTarget, setManageTarget] = useState<ProviderCardData | null>(null);

  async function refresh() {
    const board = await getInsuranceProvidersBoardAction();
    setProviders(board.providers);
    setSummary(board.summary);
    return board;
  }

  function handleCardClick(provider: ProviderCardData) {
    if (provider.status === "connected") setManageTarget(provider);
    else setConnectTarget(provider);
  }

  async function handleSynced() {
    const board = await refresh();
    const updated = board.providers.find((p) => p.id === (connectTarget?.id ?? manageTarget?.id));
    if (updated) {
      setConnectTarget(null);
      setManageTarget(updated);
    }
  }

  return (
    <div className="flex flex-col gap-5 px-4 sm:px-6 lg:px-8">
      <Card className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryTile icon={<Plug className="size-[18px]" aria-hidden="true" />} value={`${summary.connectedCount}/${summary.totalProviders}`} label="Aseguradoras conectadas" />
        <SummaryTile icon={<FileCheck2 className="size-[18px]" aria-hidden="true" />} value={String(summary.totalPoliciesSynced)} label="Pólizas sincronizadas" />
        <SummaryTile icon={<Users className="size-[18px]" aria-hidden="true" />} value={String(summary.totalClientsSynced)} label="Clientes sincronizados" />
        <SummaryTile
          icon={<Clock className="size-[18px]" aria-hidden="true" />}
          value={summary.lastSyncAt ? formatRelativeTime(summary.lastSyncAt) : "—"}
          label="Última sincronización"
        />
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {providers.map((provider) => (
          <ProviderCard key={provider.id} provider={provider} onClick={() => handleCardClick(provider)} />
        ))}
      </div>

      {connectTarget && (
        <ConnectProviderModal provider={connectTarget} open={Boolean(connectTarget)} onClose={() => setConnectTarget(null)} onSynced={handleSynced} />
      )}

      {manageTarget && (
        <ManageConnectionSheet
          provider={manageTarget}
          open={Boolean(manageTarget)}
          onClose={() => setManageTarget(null)}
          onResync={() => {
            setConnectTarget(manageTarget);
            setManageTarget(null);
          }}
          onDisconnected={refresh}
        />
      )}
    </div>
  );
}
