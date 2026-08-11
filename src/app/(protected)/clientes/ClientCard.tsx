"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Eye, Pause, Play, Archive, RefreshCw, Link2, CalendarCheck, CalendarClock, CalendarDays, FileCheck2, ListTodo } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { toast } from "@/components/toast/toast";
import type { ClientListItem } from "@/lib/clients/queries";
import { pauseClientAction, reactivateClientAction, archiveClientAction } from "@/lib/clients/actions";
import { HEALTH_LABEL_META } from "./clientHealthMeta";

const STATUS_META: Record<ClientListItem["status"], { label: string; className: string }> = {
  en_onboarding: { label: "En onboarding", className: "bg-info-bg text-info-strong" },
  activo: { label: "Activo", className: "bg-success-strong/15 text-success-strong" },
  pausado: { label: "Pausado", className: "bg-warning-bg text-warning-strong" },
  archivado: { label: "Archivado", className: "bg-surface-3 text-neutral-500" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function contractDurationDays(startDate: string, endDate: string): number {
  return Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
}

export function ClientCard({ client, accountManagerName, onChanged }: { client: ClientListItem; accountManagerName?: string; onChanged: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const status = STATUS_META[client.status];
  const health = client.healthScoreLabel ? HEALTH_LABEL_META[client.healthScoreLabel] : null;

  function run(action: () => Promise<void>, successMessage: string) {
    startTransition(async () => {
      try {
        await action();
        toast.success(successMessage);
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo completar la acción.");
      }
    });
  }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border-default bg-surface-2 transition-colors hover:bg-surface-3">
      <button
        type="button"
        onClick={() => router.push(`/clientes/${client.id}`)}
        disabled={isPending}
        className="flex flex-1 flex-col gap-3 p-4 text-left disabled:opacity-60"
      >
        <div className="flex items-start justify-between gap-2 pr-6">
          <div className="flex items-start gap-3">
            <Avatar name={client.contactName} src={client.contactAvatarUrl} size={40} />
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-foreground">{client.contactName}</h3>
              <p className="mt-0.5 truncate text-[13px] text-neutral-500">{client.profession ?? "Sin profesión"}</p>
              {client.company && <p className="truncate text-[12px] text-neutral-400">{client.company}</p>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {health && <span className={`size-2 rounded-full ${health.dot}`} title={health.label} aria-hidden="true" />}
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
          </div>
        </div>

        {client.activeContract && (
          <p className="flex items-center gap-1.5 text-[13px] text-neutral-500">
            <CalendarClock className="size-3.5" aria-hidden="true" />
            Inicio {formatDate(client.activeContract.startDate)} · Contrato {contractDurationDays(client.activeContract.startDate, client.activeContract.endDate)} días
          </p>
        )}
        {accountManagerName && <p className="text-[12px] text-neutral-400">Account Manager: {accountManagerName}</p>}

        <div className="mt-auto flex items-center justify-between text-[13px] text-neutral-500">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {client.citasCount} cita{client.citasCount === 1 ? "" : "s"}
          </span>
          <span className="flex items-center gap-1.5">
            <FileCheck2 className="size-3.5" aria-hidden="true" />
            {client.polizasCount} póliza{client.polizasCount === 1 ? "" : "s"}
          </span>
          <span className="flex items-center gap-1.5">
            <ListTodo className="size-3.5" aria-hidden="true" />
            {client.tareasPendientesCount} pend.
          </span>
        </div>
      </button>

      <div className="absolute top-3 right-3">
        <DropdownMenu
          trigger={<MoreVertical size={16} aria-hidden="true" />}
          triggerLabel="Más opciones"
          triggerClassName="flex size-7 items-center justify-center rounded-full text-neutral-400 hover:bg-surface-3 hover:text-foreground"
          items={[
            { label: "Ver cliente", icon: <Eye size={14} aria-hidden="true" />, onSelect: () => router.push(`/clientes/${client.id}`) },
            client.status === "pausado"
              ? { label: "Reactivar", icon: <Play size={14} aria-hidden="true" />, onSelect: () => run(() => reactivateClientAction(client.id), "Cliente reactivado.") }
              : { label: "Pausar", icon: <Pause size={14} aria-hidden="true" />, onSelect: () => run(() => pauseClientAction(client.id), "Cliente pausado.") },
            { label: "Renovar contrato", icon: <RefreshCw size={14} aria-hidden="true" />, onSelect: () => router.push(`/clientes/${client.id}/contrato`) },
            ...(client.linkedinProfileUrl
              ? [{ label: "Abrir LinkedIn", icon: <Link2 size={14} aria-hidden="true" />, onSelect: () => window.open(client.linkedinProfileUrl!, "_blank") }]
              : []),
            ...(client.calendlyUrl
              ? [{ label: "Abrir Calendly", icon: <CalendarCheck size={14} aria-hidden="true" />, onSelect: () => window.open(client.calendlyUrl!, "_blank") }]
              : []),
            { label: "Archivar", icon: <Archive size={14} aria-hidden="true" />, destructive: true, onSelect: () => run(() => archiveClientAction(client.id), "Cliente archivado.") },
          ]}
        />
      </div>

      <div className={`h-1 w-full ${client.status === "activo" ? "bg-success-strong" : client.status === "pausado" ? "bg-warning-strong" : "bg-surface-3"}`} aria-hidden="true" />
    </div>
  );
}
