"use client";

import Link from "next/link";
import { ArrowRight, Copy, Eye, FlaskConical, MoreVertical, Power, PowerOff, Settings, Sparkles, Trash2, Users, Clock, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import type { AgentListStats, AiAgentListItem } from "@/lib/ai-agents/queries";
import { AGENT_TYPE_PRESETS } from "./nuevo/wizardConfig";

const MODULE_LABEL: Record<string, string> = { crm: "CRM", ats: "ATS", referrals: "Referidos" };

function typeMeta(agent: AiAgentListItem) {
  if (agent.agentType) {
    const preset = AGENT_TYPE_PRESETS.find((t) => t.key === agent.agentType)!;
    return { emoji: preset.emoji, label: preset.name.replace("Agente de ", "") };
  }
  return { emoji: "🤖", label: MODULE_LABEL[agent.moduleKey] ?? agent.moduleKey };
}

function formatLastActivity(iso: string | null, status: AiAgentListItem["status"]): string {
  if (!iso) return status === "active" ? "Sin actividad reciente" : "Sin actividad";
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `Hoy · ${time}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return `Ayer · ${time}`;
  return `${date.toLocaleDateString("es", { day: "2-digit", month: "2-digit" })} · ${time}`;
}

function agentMetrics(agent: AiAgentListItem, stats: AgentListStats | undefined) {
  const s = stats ?? { conversationsHandled: 0, citasGeneradas: 0, citasProgramadas: 0, referidosGestionados: null, seguimientosPendientes: null, lastActivityAt: null };
  const flavor = agent.agentType ?? (agent.moduleKey === "referrals" ? "referrals" : null);
  if (flavor === "referrals") {
    return [
      { label: "Referidos gestionados", value: s.referidosGestionados },
      { label: "Conversaciones activas", value: s.conversationsHandled },
      { label: "Citas generadas", value: s.citasGeneradas },
    ];
  }
  if (flavor === "citas") {
    return [
      { label: "Citas generadas", value: s.citasGeneradas },
      { label: "Conversaciones activas", value: s.conversationsHandled },
      { label: "Citas programadas", value: s.citasProgramadas },
    ];
  }
  if (flavor === "seguimiento") {
    return [
      { label: "Seguimientos pendientes", value: s.seguimientosPendientes },
      { label: "Conversaciones activas", value: s.conversationsHandled },
      { label: "Citas generadas", value: s.citasGeneradas },
    ];
  }
  return [
    { label: "Conversaciones activas", value: s.conversationsHandled },
    { label: "Citas generadas", value: s.citasGeneradas },
  ];
}

export function AgentCard({
  agent,
  stats,
  isPending,
  onToggleStatus,
  onDuplicate,
  onDelete,
}: {
  agent: AiAgentListItem;
  stats: AgentListStats | undefined;
  isPending: boolean;
  onToggleStatus: (agent: AiAgentListItem) => void;
  onDuplicate: (agent: AiAgentListItem) => void;
  onDelete: (agent: AiAgentListItem) => void;
}) {
  const type = typeMeta(agent);
  const metrics = agentMetrics(agent, stats);
  const showReferralTabs = agent.moduleKey === "referrals" && Boolean(agent.advisorId);

  return (
    <Card className="group flex flex-col gap-3 transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-accent-500/40 hover:shadow-[var(--elevation-lg)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-lg">{type.emoji}</span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-foreground">{agent.name}</p>
            {agent.description && <p className="line-clamp-2 text-xs text-neutral-500">{agent.description}</p>}
          </div>
        </div>
        <DropdownMenu
          trigger={<MoreVertical size={16} aria-hidden="true" />}
          triggerLabel="Más opciones"
          items={[
            { label: "Abrir agente", icon: <Eye size={14} />, onSelect: () => (window.location.href = `/agentes-ia/${agent.id}`) },
            { label: "Editar configuración", icon: <Settings size={14} />, onSelect: () => (window.location.href = `/agentes-ia/${agent.id}?tab=general`) },
            { label: "Probar", icon: <FlaskConical size={14} />, onSelect: () => (window.location.href = `/agentes-ia/${agent.id}?tab=pruebas`) },
            ...(showReferralTabs
              ? [
                  { label: "Ver referidos", icon: <Users size={14} />, onSelect: () => (window.location.href = `/agentes-ia/${agent.id}?tab=referidos`) },
                  { label: "Ver seguimientos", icon: <Clock size={14} />, onSelect: () => (window.location.href = `/agentes-ia/${agent.id}?tab=seguimientos`) },
                ]
              : []),
            { label: "Analizar", icon: <Sparkles size={14} />, onSelect: () => (window.location.href = `/agentes-ia/${agent.id}?tab=analisis-ia`) },
            { label: "Ver estadísticas", icon: <TrendingUp size={14} />, onSelect: () => (window.location.href = `/agentes-ia/${agent.id}?tab=metricas`) },
            { label: "Duplicar", icon: <Copy size={14} />, onSelect: () => onDuplicate(agent), disabled: isPending },
            {
              label: agent.status === "active" ? "Pausar agente" : "Activar agente",
              icon: agent.status === "active" ? <PowerOff size={14} /> : <Power size={14} />,
              onSelect: () => onToggleStatus(agent),
              disabled: isPending,
            },
            { label: "Eliminar", icon: <Trash2 size={14} />, onSelect: () => onDelete(agent), destructive: true, disabled: isPending },
          ]}
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant={agent.status === "active" ? "success" : "neutral"} dot>
          {agent.status === "active" ? "Activo" : "Inactivo"}
        </Badge>
        <Badge variant="accent">{type.label}</Badge>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-neutral-500">
        <span>{agent.channels.includes("whatsapp") ? "💬 WhatsApp" : "Sin canal"}</span>
        <span className="font-mono">{agent.model}</span>
        <Badge variant={agent.responseMode === "auto" ? "accent" : "warning"}>{agent.responseMode === "auto" ? "Automático" : "Asistido"}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-border-default pt-3">
        {metrics.map((m) => (
          <div key={m.label}>
            <p className="font-mono text-lg font-semibold text-foreground">{m.value === null ? "—" : m.value}</p>
            <p className="text-[11px] leading-tight text-neutral-500">{m.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border-default pt-3">
        <p className="text-xs text-neutral-500">{formatLastActivity(stats?.lastActivityAt ?? null, agent.status)}</p>
        <Link
          href={`/agentes-ia/${agent.id}`}
          className="flex items-center gap-1 text-sm font-medium text-accent-600 opacity-80 transition-opacity group-hover:opacity-100 hover:underline"
        >
          Abrir agente <ArrowRight className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
    </Card>
  );
}


export { MODULE_LABEL };
