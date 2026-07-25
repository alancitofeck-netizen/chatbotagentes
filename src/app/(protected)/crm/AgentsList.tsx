"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Minus, Pencil, Search, StickyNote, TrendingDown, TrendingUp, Trophy, Users2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { Sparkline } from "@/components/ui/Sparkline";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { toast } from "@/components/toast/toast";
import type { AgentListItem, Team } from "@/lib/agents/queries";
import { getAgentListAction } from "@/lib/agents/actions";
import { updateMemberRole } from "@/lib/settings/actions";
import { useWorkspacePresence } from "@/lib/presence/useWorkspacePresence";
import { AgentEditSheet } from "./AgentEditSheet";
import { AgentNoteSheet } from "./AgentNoteSheet";
import { ManageTeamsSheet } from "./ManageTeamsSheet";

const ROLE_LABEL: Record<string, string> = { owner: "Owner", admin: "Admin", agent: "Agente" };
const ROLE_BADGE: Record<string, BadgeVariant> = { owner: "accent", admin: "warning", agent: "neutral" };
/** All 3 roles are assignable now — assigning "owner" doesn't just set a
 * role, it *transfers* ownership (updateMemberRole demotes the acting Owner
 * to Admin in the same atomic RPC call, see
 * supabase/migrations/0047_transfer_workspace_ownership.sql). */
type AssignableRole = "owner" | "admin" | "agent";
const ROLE_ORDER: AssignableRole[] = ["owner", "admin", "agent"];

const PRESENCE_LABEL: Record<"online" | "away" | "offline", { emoji: string; label: string }> = {
  online: { emoji: "🟢", label: "Online" },
  away: { emoji: "🟡", label: "Ausente" },
  offline: { emoji: "🔴", label: "Offline" },
};

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "warning" | "neutral" }> = {
  active: { label: "Activo", variant: "success" },
  vacation: { label: "Vacaciones", variant: "warning" },
  inactive: { label: "Inactivo", variant: "neutral" },
};

/** Verde/Amarillo/Naranja/Rojo per el pedido del usuario — "naranja" no es
 * un token semántico del design system (solo success/warning/error), así
 * que las 4 franjas se resuelven a un color CSS directo, no clases Tailwind. */
function scoreColor(score: number): string {
  if (score >= 85) return "var(--color-success-strong)";
  if (score >= 70) return "var(--color-warning-strong)";
  if (score >= 50) return "#C2650A";
  return "var(--color-error-strong)";
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


export function AgentsList({
  initialAgents,
  initialTeams,
  workspaceId,
  isOwner,
}: {
  initialAgents: AgentListItem[];
  initialTeams: Team[];
  workspaceId: string;
  /** Only the Owner sees "Cambiar rol" / can act on it — updateMemberRole
   * enforces this same rule server-side (defense in depth, not just a UI
   * gate). Admin and Agent never see the button at all. */
  isOwner: boolean;
}) {
  const router = useRouter();
  const [agents, setAgents] = useState(initialAgents);
  const presence = useWorkspacePresence(workspaceId);
  const [teams, setTeams] = useState(initialTeams);
  const [search, setSearch] = useState("");
  const [teamId, setTeamId] = useState("");
  const [status, setStatus] = useState("");
  const [editAgent, setEditAgent] = useState<AgentListItem | null>(null);
  const [noteAgent, setNoteAgent] = useState<AgentListItem | null>(null);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [roleChangeAgent, setRoleChangeAgent] = useState<AgentListItem | null>(null);
  const [pendingRole, setPendingRole] = useState<AssignableRole>("agent");
  const [, startTransition] = useTransition();
  const [isChangingRole, startRoleChange] = useTransition();

  function openRoleChange(agent: AgentListItem, role: AssignableRole) {
    setPendingRole(role);
    setRoleChangeAgent(agent);
  }

  function confirmRoleChange() {
    if (!roleChangeAgent) return;
    const agent = roleChangeAgent;
    const role = pendingRole;
    startRoleChange(async () => {
      try {
        await updateMemberRole(agent.memberId, role);
        setRoleChangeAgent(null);
        if (role === "owner") {
          toast.success(`${agent.fullName} ahora es el Owner del workspace. Tu rol pasó a Admin.`);
          // The acting Owner just demoted themselves to Admin — `isOwner` is
          // a server-rendered prop from this page's own load, so a plain
          // refetch() (agent list data only) would leave it stale, still
          // showing clickable role badges the server would now reject.
          // router.refresh() re-runs the Server Component tree to pick up
          // the new role immediately, without a full page reload.
          router.refresh();
        } else {
          toast.success(`Rol de ${agent.fullName} actualizado a ${ROLE_LABEL[role]}.`);
        }
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo cambiar el rol.");
      }
    });
  }

  function refetch() {
    startTransition(async () => {
      setAgents(
        await getAgentListAction({
          teamId: teamId || undefined,
          status: status || undefined,
          search: search || undefined,
        }),
      );
    });
  }

  function refetchTeamsAndAgents() {
    startTransition(async () => {
      const [freshAgents] = await Promise.all([getAgentListAction({ teamId: teamId || undefined, status: status || undefined, search: search || undefined })]);
      setAgents(freshAgents);
    });
  }

  function handleFilterChange() {
    refetch();
  }

  const top3 = [...agents].sort((a, b) => b.score - a.score).slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
      {top3.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {top3.map((a, i) => (
            <div key={a.memberId} className="flex items-center gap-2 rounded-full border border-border-default bg-surface-1 px-3 py-1.5 shadow-[var(--elevation-xs)]">
              <span aria-hidden="true">{medals[i]}</span>
              <span className="text-sm font-medium text-foreground">{a.fullName}</span>
              <span className="font-mono text-sm text-neutral-500">{a.score} pts</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onBlur={handleFilterChange}
              onKeyDown={(e) => e.key === "Enter" && handleFilterChange()}
              placeholder="Buscar agente…"
              className="w-56 rounded-sm border border-border-strong bg-surface-1 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
            />
          </div>
          <Select
            label="Equipo"
            containerClassName="w-40"
            value={teamId}
            onChange={(e) => {
              setTeamId(e.target.value);
              startTransition(async () => {
                setAgents(
                  await getAgentListAction({ teamId: e.target.value || undefined, status: status || undefined, search: search || undefined }),
                );
              });
            }}
          >
            <option value="">Todos</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Select
            label="Estado"
            containerClassName="w-36"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              startTransition(async () => {
                setAgents(
                  await getAgentListAction({ teamId: teamId || undefined, status: e.target.value || undefined, search: search || undefined }),
                );
              });
            }}
          >
            <option value="">Todos</option>
            <option value="active">Activo</option>
            <option value="vacation">Vacaciones</option>
            <option value="inactive">Inactivo</option>
          </Select>
        </div>
        <Button size="sm" variant="secondary" onClick={() => setTeamsOpen(true)}>
          <Users2 size={15} aria-hidden="true" />
          Gestionar equipos
        </Button>
      </div>

      {agents.length === 0 ? (
        <EmptyState icon={Trophy} title="Sin agentes" description="No hay resultados para este filtro." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-default text-xs uppercase text-neutral-500">
                <th className="px-2.5 py-2 font-medium">Agente</th>
                <th className="px-2.5 py-2 font-medium">Rol</th>
                <th className="px-2.5 py-2 font-medium">Estado</th>
                <th className="px-2.5 py-2 font-medium">Score</th>
                <th className="px-2.5 py-2 font-medium">Tendencia</th>
                <th className="px-2.5 py-2 font-medium">Leads</th>
                <th className="px-2.5 py-2 font-medium">Respuesta</th>
                <th className="px-2.5 py-2 font-medium">Reuniones</th>
                <th className="px-2.5 py-2 font-medium">Conversión</th>
                <th className="px-2.5 py-2 font-medium">Última actividad</th>
                <th className="px-2.5 py-2 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => {
                const statusInfo = STATUS_LABEL[a.status] ?? STATUS_LABEL.active;
                const progress = a.weeklyTarget ? Math.min(100, Math.round((a.meetingsThisWeek / a.weeklyTarget) * 100)) : null;
                const presenceStatus: "online" | "away" | "offline" = presence[a.memberId] ?? "offline";
                const presenceInfo = PRESENCE_LABEL[presenceStatus];
                return (
                  <tr key={a.memberId} className="border-b border-border-default last:border-b-0 hover:bg-surface-2">
                    <td className="px-2.5 py-2">
                      <Link href={`/crm/agents/${a.memberId}`} className="flex items-center gap-3">
                        <Avatar name={a.fullName} src={a.avatarUrl} size={32} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{a.fullName}</p>
                          <p className="truncate text-xs text-neutral-500">
                            {a.title || "Sin cargo"} · <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                          </p>
                          {a.teamName && <p className="truncate text-xs text-neutral-400">{a.teamName}</p>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-2.5 py-2">
                      {isOwner && a.role !== "owner" ? (
                        <DropdownMenu
                          triggerLabel={`Cambiar rol de ${a.fullName}`}
                          triggerClassName="inline-flex rounded-full focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
                          trigger={
                            <Badge variant={ROLE_BADGE[a.role] ?? "neutral"} className="cursor-pointer hover:opacity-80">
                              {ROLE_LABEL[a.role] ?? a.role}
                            </Badge>
                          }
                          items={ROLE_ORDER.filter((r) => r !== a.role).map((r) => ({
                            label: ROLE_LABEL[r],
                            onSelect: () => openRoleChange(a, r),
                          }))}
                        />
                      ) : (
                        <Badge variant={ROLE_BADGE[a.role] ?? "neutral"}>{ROLE_LABEL[a.role] ?? a.role}</Badge>
                      )}
                    </td>
                    <td className="px-2.5 py-2">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs text-neutral-500"
                        title={presenceStatus === "offline" ? formatRelative(a.sessionLastActiveAt) : undefined}
                      >
                        <span aria-hidden="true">{presenceInfo.emoji}</span>
                        {presenceInfo.label}
                      </span>
                    </td>
                    <td className="px-2.5 py-2">
                      <span className="font-mono text-lg font-semibold" style={{ color: scoreColor(a.score) }}>
                        {a.score}
                      </span>
                    </td>
                    <td className="px-2.5 py-2">
                      <div className="flex items-center gap-2">
                        <Sparkline data={a.trend} width={48} height={24} color={a.trendDirection === "down" ? "#C1484F" : "var(--color-accent-500)"} />
                        {a.trendDirection === "up" && <TrendingUp className="size-4 text-success-strong" aria-hidden="true" />}
                        {a.trendDirection === "down" && <TrendingDown className="size-4 text-error-strong" aria-hidden="true" />}
                        {a.trendDirection === "flat" && <Minus className="size-4 text-neutral-400" aria-hidden="true" />}
                      </div>
                    </td>
                    <td className="px-2.5 py-2 font-mono text-xs">
                      {a.leadsContacted}/{a.leadsAssigned}
                    </td>
                    <td className="px-2.5 py-2 font-mono text-xs">{a.responseRate}%</td>
                    <td className="px-2.5 py-2">
                      <p className="font-mono text-xs">
                        {a.meetingsCompleted}/{a.meetingsScheduled}
                      </p>
                      {a.weeklyTarget !== null && (
                        <div className="mt-1 flex items-center gap-1.5">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-3">
                            <div className="h-full rounded-full bg-accent-500" style={{ width: `${progress}%` }} />
                          </div>
                          <span className="text-[11px] text-neutral-500">
                            {a.meetingsThisWeek}/{a.weeklyTarget}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-2.5 py-2 font-mono text-xs">{a.conversionRate}%</td>
                    <td className="px-2.5 py-2 text-xs text-neutral-500">{formatRelative(a.lastActivityAt)}</td>
                    <td className="px-2.5 py-2">
                      <div className="flex items-center gap-1">
                        <Link
                          href={`/crm/agents/${a.memberId}`}
                          title="Ver perfil"
                          className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-surface-2 hover:text-foreground"
                        >
                          <Trophy size={15} aria-hidden="true" />
                        </Link>
                        <button
                          type="button"
                          title="Editar"
                          onClick={() => setEditAgent(a)}
                          className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-surface-2 hover:text-foreground"
                        >
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          title="Agregar nota"
                          onClick={() => setNoteAgent(a)}
                          className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-surface-2 hover:text-foreground"
                        >
                          <StickyNote size={15} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <AgentEditSheet
        key={editAgent?.memberId ?? "closed"}
        agent={editAgent}
        teams={teams}
        agents={agents}
        onClose={() => setEditAgent(null)}
        onChanged={refetch}
      />
      <AgentNoteSheet
        key={`note-${noteAgent?.memberId ?? "closed"}`}
        agent={noteAgent}
        onClose={() => setNoteAgent(null)}
      />
      <ManageTeamsSheet
        open={teamsOpen}
        teams={teams}
        agents={agents}
        onClose={() => setTeamsOpen(false)}
        onChanged={(freshTeams) => {
          setTeams(freshTeams);
          refetchTeamsAndAgents();
        }}
      />

      <ConfirmDialog
        open={roleChangeAgent !== null}
        title={pendingRole === "owner" ? "Transferir propiedad del workspace" : "Cambiar rol"}
        description={
          roleChangeAgent &&
          (pendingRole === "owner" ? (
            <>
              Vas a transferir la propiedad de este workspace a{" "}
              <strong className="text-foreground">{roleChangeAgent.fullName}</strong>. Tu propio rol pasará
              automáticamente a <Badge variant={ROLE_BADGE.admin}>Admin</Badge> — solo puede existir un Owner por
              workspace. Esta acción no se puede deshacer directamente, solo transfiriendo la propiedad de nuevo.
            </>
          ) : (
            <>
              Vas a cambiar el rol de <strong className="text-foreground">{roleChangeAgent.fullName}</strong> de{" "}
              <Badge variant={ROLE_BADGE[roleChangeAgent.role] ?? "neutral"}>
                {ROLE_LABEL[roleChangeAgent.role] ?? roleChangeAgent.role}
              </Badge>{" "}
              a <Badge variant={ROLE_BADGE[pendingRole]}>{ROLE_LABEL[pendingRole]}</Badge>.
            </>
          ))
        }
        confirmLabel={pendingRole === "owner" ? "Transferir propiedad" : "Cambiar rol"}
        isLoading={isChangingRole}
        onConfirm={confirmRoleChange}
        onCancel={() => setRoleChangeAgent(null)}
      />
    </div>
  );
}
