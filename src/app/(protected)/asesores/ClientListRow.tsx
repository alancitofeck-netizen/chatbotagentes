"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Eye, Pause, Play, Archive, RefreshCw, Link2, CalendarCheck, CalendarDays, FileCheck2, ListTodo } from "lucide-react";
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

/** Fila compacta para la vista "lista" del toggle grilla/lista — mismos
 * datos y acciones que ClientCard.tsx, layout horizontal. */
export function ClientListRow({ client, accountManagerName, onChanged }: { client: ClientListItem; accountManagerName?: string; onChanged: () => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
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
    <div className="flex items-center gap-3 rounded-xl border border-border-default bg-surface-2 p-3 transition-colors hover:bg-surface-3">
      <button
        type="button"
        onClick={() => router.push(`/asesores/${client.id}`)}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <Avatar name={client.contactName} src={client.contactAvatarUrl} size={36} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[14px] font-semibold text-foreground">{client.contactName}</h3>
            {health && <span className={`size-2 shrink-0 rounded-full ${health.dot}`} title={health.label} aria-hidden="true" />}
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}>{status.label}</span>
          </div>
          <p className="truncate text-[12px] text-neutral-500">{client.profession ?? "Sin profesión"}{client.company ? ` · ${client.company}` : ""}</p>
        </div>
        <div className="hidden shrink-0 items-center gap-4 text-[13px] text-neutral-500 sm:flex">
          {accountManagerName && <span className="truncate">{accountManagerName}</span>}
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {client.citasCount}
          </span>
          <span className="flex items-center gap-1.5">
            <FileCheck2 className="size-3.5" aria-hidden="true" />
            {client.polizasCount}
          </span>
          <span className="flex items-center gap-1.5">
            <ListTodo className="size-3.5" aria-hidden="true" />
            {client.tareasPendientesCount}
          </span>
        </div>
      </button>

      <DropdownMenu
        trigger={<MoreVertical size={16} aria-hidden="true" />}
        triggerLabel="Más opciones"
        triggerClassName="flex size-7 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-surface-3 hover:text-foreground"
        items={[
          { label: "Ver asesor", icon: <Eye size={14} aria-hidden="true" />, onSelect: () => router.push(`/asesores/${client.id}`) },
          client.status === "pausado"
            ? { label: "Reactivar", icon: <Play size={14} aria-hidden="true" />, onSelect: () => run(() => reactivateClientAction(client.id), "Asesor reactivado.") }
            : { label: "Pausar", icon: <Pause size={14} aria-hidden="true" />, onSelect: () => run(() => pauseClientAction(client.id), "Asesor pausado.") },
          { label: "Renovar contrato", icon: <RefreshCw size={14} aria-hidden="true" />, onSelect: () => router.push(`/asesores/${client.id}/contrato`) },
          ...(client.linkedinProfileUrl
            ? [{ label: "Abrir LinkedIn", icon: <Link2 size={14} aria-hidden="true" />, onSelect: () => window.open(client.linkedinProfileUrl!, "_blank") }]
            : []),
          ...(client.calendlyUrl
            ? [{ label: "Abrir Calendly", icon: <CalendarCheck size={14} aria-hidden="true" />, onSelect: () => window.open(client.calendlyUrl!, "_blank") }]
            : []),
          { label: "Archivar", icon: <Archive size={14} aria-hidden="true" />, destructive: true, onSelect: () => run(() => archiveClientAction(client.id), "Asesor archivado.") },
        ]}
      />
    </div>
  );
}
