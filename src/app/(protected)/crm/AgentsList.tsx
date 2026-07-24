"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { Minus, Pencil, Search, StickyNote, TrendingDown, TrendingUp, Trophy, Users2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AgentListItem, Team } from "@/lib/agents/queries";
import { getAgentListAction } from "@/lib/agents/actions";
import { useWorkspacePresence } from "@/lib/presence/useWorkspacePresence";
import { AgentEditSheet } from "./AgentEditSheet";
import { AgentNoteSheet } from "./AgentNoteSheet";
import { ManageTeamsSheet } from "./ManageTeamsSheet";

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

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const points = data.map((v, i) => ({ i, v }));
  return (
    <div className="h-8 w-16">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AgentsList({
  initialAgents,
  initialTeams,
  workspaceId,
}: {
  initialAgents: AgentListItem[];
  initialTeams: Team[];
  workspaceId: string;
}) {
  const [agents, setAgents] = useState(initialAgents);
  const presence = useWorkspacePresence(workspaceId);
  const [teams, setTeams] = useState(initialTeams);
  const [search, setSearch] = useState("");
  const [teamId, setTeamId] = useState("");
  const [status, setStatus] = useState("");
  const [editAgent, setEditAgent] = useState<AgentListItem | null>(null);
  const [noteAgent, setNoteAgent] = useState<AgentListItem | null>(null);
  const [teamsOpen, setTeamsOpen] = useState(false);
  const [, startTransition] = useTransition();

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
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-default text-xs uppercase text-neutral-500">
                <th className="px-4 py-3 font-medium">Agente</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Tendencia</th>
                <th className="px-4 py-3 font-medium">Leads</th>
                <th className="px-4 py-3 font-medium">Respuesta</th>
                <th className="px-4 py-3 font-medium">Reuniones</th>
                <th className="px-4 py-3 font-medium">Conversión</th>
                <th className="px-4 py-3 font-medium">Última actividad</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
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
                    <td className="px-4 py-3">
                      <Link href={`/crm/agents/${a.memberId}`} className="flex items-center gap-3">
                        <Avatar name={a.fullName} size={36} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{a.fullName}</p>
                          <p className="truncate text-xs text-neutral-500">
                            {a.title || "Sin cargo"} · <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                          </p>
                          {a.teamName && <p className="truncate text-xs text-neutral-400">{a.teamName}</p>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs text-neutral-500"
                        title={presenceStatus === "offline" ? formatRelative(a.sessionLastActiveAt) : undefined}
                      >
                        <span aria-hidden="true">{presenceInfo.emoji}</span>
                        {presenceInfo.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-2xl font-semibold" style={{ color: scoreColor(a.score) }}>
                        {a.score}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Sparkline data={a.trend} color={a.trendDirection === "down" ? "#C1484F" : "var(--color-accent-500)"} />
                        {a.trendDirection === "up" && <TrendingUp className="size-4 text-success-strong" aria-hidden="true" />}
                        {a.trendDirection === "down" && <TrendingDown className="size-4 text-error-strong" aria-hidden="true" />}
                        {a.trendDirection === "flat" && <Minus className="size-4 text-neutral-400" aria-hidden="true" />}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {a.leadsContacted}/{a.leadsAssigned}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{a.responseRate}%</td>
                    <td className="px-4 py-3">
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
                    <td className="px-4 py-3 font-mono text-xs">{a.conversionRate}%</td>
                    <td className="px-4 py-3 text-xs text-neutral-500">{formatRelative(a.lastActivityAt)}</td>
                    <td className="px-4 py-3">
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
    </div>
  );
}
