"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  Calendar,
  Eye,
  HardDrive,
  MessageCircle,
  MoreVertical,
  Power,
  Sheet as SheetIcon,
  Sparkles,
  Users2,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Sparkline } from "@/components/ui/Sparkline";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { toast } from "@/components/toast/toast";
import type { PlatformWorkspaceSummary } from "@/lib/platform/queries";
import { enterSupervisorMode, toggleWorkspaceStatus } from "@/lib/platform/actions";
import { useMultiWorkspacePresence } from "@/lib/presence/useMultiWorkspacePresence";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function formatRelative(iso: string | null) {
  if (!iso) return "Sin actividad";
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  return `hace ${Math.round(diffH / 24)} d`;
}

function StatusDot({ active, title }: { active: boolean; title: string }) {
  return (
    <span
      title={title}
      className={`inline-block size-2 rounded-full ${active ? "bg-success-strong" : "bg-neutral-300"}`}
      aria-hidden="true"
    />
  );
}

function IntegrationIcon({ active, icon: Icon, label }: { active: boolean; icon: typeof Calendar; label: string }) {
  return (
    <span
      title={`${label}: ${active ? "conectado" : "sin conectar"}`}
      className={`flex size-6 items-center justify-center rounded-md ${
        active ? "bg-success-bg text-success-strong" : "bg-surface-3 text-neutral-400"
      }`}
    >
      <Icon size={13} aria-hidden="true" />
    </span>
  );
}

function WorkspaceRow({ w, onlineCount }: { w: PlatformWorkspaceSummary; onlineCount: number }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState(w.status);

  function goTo(path: string) {
    startTransition(async () => {
      await enterSupervisorMode(w.workspaceId, path);
      // A full page load, not router.push() — this is an admin-only entry
      // point, not a hot path, and confirmed live: a client-side push right
      // after the action resolves can get silently dropped if anything
      // else on this data-heavy page (sparklines, live presence counts,
      // relative-timestamp text) trips a hydration mismatch in the same
      // tick, which tears down/rebuilds the client tree and interrupts an
      // in-flight SPA navigation. A hard navigation has no such dependency
      // on client Router/hydration state — it always lands correctly.
      window.location.href = path;
    });
  }

  function handleToggleStatus() {
    const next = status === "active" ? "inactive" : "active";
    startTransition(async () => {
      try {
        await toggleWorkspaceStatus(w.workspaceId, next);
        setStatus(next);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar el estado.");
      }
    });
  }

  return (
    <tr className="border-b border-border-default last:border-b-0 hover:bg-surface-2">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={w.name} size={36} />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{w.name}</p>
            <p className="truncate text-xs text-neutral-500">{w.slug}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <p className="text-sm text-foreground">{w.primaryUserName}</p>
        <p className="truncate text-xs text-neutral-500">{w.primaryUserEmail}</p>
      </td>
      <td className="px-4 py-3">
        <button type="button" onClick={handleToggleStatus} disabled={isPending} className="disabled:opacity-50">
          <Badge variant={status === "active" ? "success" : "neutral"}>
            {status === "active" ? "Activo" : "Inactivo"}
          </Badge>
        </button>
      </td>
      <td className="px-4 py-3">
        <Badge variant="neutral">{w.plan}</Badge>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <Users2 size={13} className="text-neutral-400" aria-hidden="true" />
          <span className="font-mono text-xs">{w.memberCount}</span>
          {onlineCount > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-success-strong">
              <span className="size-1.5 rounded-full bg-success-strong" aria-hidden="true" />
              {onlineCount} online
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs">{w.leadsCount}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs">{w.openConversationsCount}</span>
          <Sparkline data={w.conversationTrend} color="var(--color-accent-500)" width={48} height={24} />
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs">{w.opportunitiesCount}</td>
      <td className="px-4 py-3 font-mono text-xs">{w.todayBookingsCount}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <StatusDot active={w.botActive} title={w.botActive ? "Bot IA activo" : "Bot IA inactivo"} />
          <StatusDot active={w.hasWhatsApp} title={w.hasWhatsApp ? "WhatsApp conectado" : "WhatsApp sin conectar"} />
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <IntegrationIcon active={w.hasWhatsApp} icon={MessageCircle} label="WhatsApp" />
          <IntegrationIcon active={w.hasGoogleCalendar} icon={Calendar} label="Google Calendar" />
          <IntegrationIcon active={w.hasGoogleSheets} icon={SheetIcon} label="Google Sheets" />
          <IntegrationIcon active={w.hasGoogleDrive} icon={HardDrive} label="Google Drive" />
          <IntegrationIcon active={w.hasAi} icon={Sparkles} label="OpenRouter (IA)" />
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-neutral-500">{formatRelative(w.lastActivityAt)}</td>
      <td className="px-4 py-3 text-xs text-neutral-500">{formatDate(w.createdAt)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Administrar"
            disabled={isPending}
            onClick={() => goTo("/dashboard")}
            className="flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-2 disabled:opacity-50"
          >
            <Eye size={13} aria-hidden="true" />
            Administrar
          </button>
          <DropdownMenu
            trigger={<MoreVertical size={15} aria-hidden="true" />}
            triggerLabel="Más acciones"
            items={[
              { label: "Ver Dashboard", icon: <Eye size={14} />, onSelect: () => goTo("/dashboard") },
              { label: "Ver CRM", icon: <Bot size={14} />, onSelect: () => goTo("/crm") },
              { label: "Ver Integraciones", icon: <Sparkles size={14} />, onSelect: () => goTo("/profile?tab=integrations") },
              { label: "Ver Usuarios", icon: <Users2 size={14} />, onSelect: () => goTo("/profile?tab=workspace") },
              {
                label: status === "active" ? "Desactivar Workspace" : "Activar Workspace",
                icon: <Power size={14} />,
                destructive: status === "active",
                onSelect: handleToggleStatus,
              },
            ]}
          />
        </div>
      </td>
    </tr>
  );
}

/** Owner global's view of the CRM "Agentes" tab — reuses this existing tab
 * instead of a separate admin module (per the corrected architecture): one
 * row per client Workspace, richly visual (badges, live presence dot,
 * integration icons, a 7-day conversation-trend sparkline) rather than a
 * plain table. "Administrar"/the "⋮" menu enter read-only supervisor mode
 * via enterSupervisorMode (src/lib/platform/actions.ts), landing on
 * whichever real page of that workspace (Dashboard/CRM/Configuración) makes
 * sense — no dedicated admin pages built for this, by design. Rendered by
 * CrmPageShell.tsx only when the viewer is a platform admin; every other
 * owner/admin still sees the normal per-workspace AgentsList here. */
export function PlatformWorkspacesTable({ workspaces }: { workspaces: PlatformWorkspaceSummary[] }) {
  const onlineByWorkspace = useMultiWorkspacePresence(workspaces.map((w) => w.workspaceId));

  return (
    <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
      <table className="w-full min-w-[1500px] text-left text-sm">
        <thead>
          <tr className="border-b border-border-default text-xs uppercase text-neutral-500">
            <th className="px-4 py-3 font-medium">Workspace</th>
            <th className="px-4 py-3 font-medium">Usuario principal</th>
            <th className="px-4 py-3 font-medium">Estado</th>
            <th className="px-4 py-3 font-medium">Plan</th>
            <th className="px-4 py-3 font-medium">Miembros</th>
            <th className="px-4 py-3 font-medium">Leads</th>
            <th className="px-4 py-3 font-medium">Conversaciones</th>
            <th className="px-4 py-3 font-medium">Oportunidades</th>
            <th className="px-4 py-3 font-medium">Agenda hoy</th>
            <th className="px-4 py-3 font-medium">Bot / WA</th>
            <th className="px-4 py-3 font-medium">Integraciones</th>
            <th className="px-4 py-3 font-medium">Última actividad</th>
            <th className="px-4 py-3 font-medium">Creado</th>
            <th className="px-4 py-3 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {workspaces.map((w) => (
            <WorkspaceRow key={w.workspaceId} w={w} onlineCount={onlineByWorkspace[w.workspaceId] ?? 0} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
