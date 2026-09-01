"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles, Bot, CircleDot, MessagesSquare, CalendarCheck2, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/toast/toast";
import type { AgentListStats, AiAgentListItem } from "@/lib/ai-agents/queries";
import { duplicateAiAgent, toggleAiAgentStatus, deleteAiAgent } from "@/lib/ai-agents/actions";
import { CreateAiAgentSheet } from "./CreateAiAgentSheet";
import { AgentCard } from "./AgentCard";
import { useAutoStartTour } from "@/components/onboarding/useAutoStartTour";
import { ContextualHint } from "@/components/onboarding/ContextualHint";

function MetricTile({ icon: Icon, iconClassName, label, value, sublabel }: { icon: typeof Bot; iconClassName: string; label: string; value: number; sublabel: string }) {
  return (
    <Card className="flex items-center gap-3">
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-xs text-neutral-500">{label}</p>
        <p className="font-mono text-2xl font-semibold text-foreground">{value}</p>
        <p className="text-[11px] text-neutral-400">{sublabel}</p>
      </div>
    </Card>
  );
}

const MODULE_FILTER_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "referrals", label: "Referidos" },
  { value: "citas", label: "Citas" },
  { value: "seguimiento", label: "Seguimiento" },
  { value: "crm", label: "CRM" },
];
const STATUS_FILTER_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
];
const CHANNEL_FILTER_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "ninguno", label: "Sin canal" },
];
const MODE_FILTER_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "auto", label: "Automático" },
  { value: "assisted", label: "Asistido" },
];

/** Deriva el valor de filtro "módulo" de un agente: usa agent_type cuando
 * existe (Citas/Seguimiento son distinguibles ahí), si no cae al module_key
 * real — nunca inventa un tipo para un agente que no lo tiene. */
function moduleFilterValue(agent: AiAgentListItem): string {
  return agent.agentType ?? agent.moduleKey;
}

export function AiAgentsSection({ initialAgents, stats }: { initialAgents: AiAgentListItem[]; stats: Record<string, AgentListStats> }) {
  useAutoStartTour("ai-agents-intro");
  const [agents, setAgents] = useState(initialAgents);
  const [createOpen, setCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [channelFilter, setChannelFilter] = useState("todos");
  const [modeFilter, setModeFilter] = useState("todos");

  const totals = useMemo(() => {
    let conversations = 0;
    let citas = 0;
    for (const a of agents) {
      const s = stats[a.id];
      if (!s) continue;
      conversations += s.conversationsHandled;
      citas += s.citasGeneradas;
    }
    return { total: agents.length, active: agents.filter((a) => a.status === "active").length, conversations, citas };
  }, [agents, stats]);

  const filteredAgents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agents.filter((a) => {
      if (q && !a.name.toLowerCase().includes(q) && !a.description.toLowerCase().includes(q)) return false;
      if (moduleFilter !== "todos" && moduleFilterValue(a) !== moduleFilter) return false;
      if (statusFilter !== "todos" && a.status !== statusFilter) return false;
      if (channelFilter === "whatsapp" && !a.channels.includes("whatsapp")) return false;
      if (channelFilter === "ninguno" && a.channels.length > 0) return false;
      if (modeFilter !== "todos" && a.responseMode !== modeFilter) return false;
      return true;
    });
  }, [agents, search, moduleFilter, statusFilter, channelFilter, modeFilter]);

  const hasActiveFilters = search !== "" || moduleFilter !== "todos" || statusFilter !== "todos" || channelFilter !== "todos" || modeFilter !== "todos";

  function clearFilters() {
    setSearch("");
    setModuleFilter("todos");
    setStatusFilter("todos");
    setChannelFilter("todos");
    setModeFilter("todos");
  }

  function handleToggleStatus(agent: AiAgentListItem) {
    const nextStatus = agent.status === "active" ? "inactive" : "active";
    startTransition(async () => {
      try {
        await toggleAiAgentStatus(agent.id, nextStatus);
        setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, status: nextStatus } : a)));
        toast.success(nextStatus === "active" ? "Agente activado." : "Agente pausado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar el estado.");
      }
    });
  }

  function handleDuplicate(agent: AiAgentListItem) {
    startTransition(async () => {
      try {
        await duplicateAiAgent(agent.id);
        toast.success("Agente duplicado.");
        window.location.reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo duplicar el agente.");
      }
    });
  }

  function handleDelete(agent: AiAgentListItem) {
    if (!window.confirm(`¿Eliminar el agente "${agent.name}"? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      try {
        await deleteAiAgent(agent.id);
        setAgents((prev) => prev.filter((a) => a.id !== agent.id));
        toast.success("Agente eliminado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo eliminar el agente.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={() => setCreateOpen(true)} className="text-xs text-neutral-500 hover:text-foreground hover:underline">
          Crear agente ATS (formulario simple)
        </button>
        <Link href="/agentes-ia/nuevo" data-tour="ai-agents.new-link">
          <Button size="sm">
            <Sparkles size={15} aria-hidden="true" />
            Nuevo agente
          </Button>
        </Link>
      </div>

      {agents.length === 0 ? (
        <EmptyState icon={Sparkles} title="Sin agentes IA todavía" description="Creá el primero para empezar a automatizar conversaciones." />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricTile icon={Bot} iconClassName="bg-accent-100 text-accent-700" label="Agentes" value={totals.total} sublabel="Total de agentes creados" />
            <MetricTile icon={CircleDot} iconClassName="bg-success-bg text-success-strong" label="Activos" value={totals.active} sublabel="Agentes trabajando ahora" />
            <MetricTile icon={MessagesSquare} iconClassName="bg-info-bg text-info-strong" label="Conversaciones" value={totals.conversations} sublabel="En los últimos 7 días" />
            <MetricTile icon={CalendarCheck2} iconClassName="bg-warning-bg text-warning-strong" label="Citas generadas" value={totals.citas} sublabel="En los últimos 7 días" />
          </div>

          <ContextualHint hintKey="ai-agents-filters-first-use" title="🔎 ¿Primera vez usando filtros?" description="Te mostramos rápidamente cómo funcionan.">
          <Card data-tour="ai-agents.filters">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <Input label="Buscar agente" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar agente..." />
              </div>
              <Select label="Módulo" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} containerClassName="w-36">
                {MODULE_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <Select label="Estado" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} containerClassName="w-32">
                {STATUS_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <Select label="Canal" value={channelFilter} onChange={(e) => setChannelFilter(e.target.value)} containerClassName="w-32">
                {CHANNEL_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              <Select label="Modo" value={modeFilter} onChange={(e) => setModeFilter(e.target.value)} containerClassName="w-32">
                {MODE_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  Limpiar filtros
                </Button>
              )}
            </div>
          </Card>
          </ContextualHint>

          {filteredAgents.length === 0 ? (
            <EmptyState icon={Sparkles} title="Ningún agente coincide con los filtros" description="Probá limpiar los filtros o buscar con otro término." />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAgents.map((a) => (
                <AgentCard key={a.id} agent={a} stats={stats[a.id]} isPending={isPending} onToggleStatus={handleToggleStatus} onDuplicate={handleDuplicate} onDelete={handleDelete} />
              ))}
              <Link
                href="/agentes-ia/nuevo"
                className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong p-6 text-center transition-colors hover:border-accent-500 hover:bg-surface-2"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-accent-100 text-accent-700">
                  <Plus className="size-5" aria-hidden="true" />
                </span>
                <p className="text-sm font-medium text-foreground">Crear nuevo agente</p>
                <p className="text-xs text-neutral-500">Configurá un nuevo agente IA para automatizar tareas comerciales.</p>
              </Link>
            </div>
          )}
        </>
      )}

      {createOpen && <CreateAiAgentSheet onClose={() => setCreateOpen(false)} />}
    </div>
  );
}
