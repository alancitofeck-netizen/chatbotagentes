"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Sparkles, MoreVertical, Eye, Copy, Power, PowerOff, Trash2, FlaskConical, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { toast } from "@/components/toast/toast";
import type { AiAgentListItem } from "@/lib/ai-agents/queries";
import { duplicateAiAgent, toggleAiAgentStatus, deleteAiAgent } from "@/lib/ai-agents/actions";
import { CreateAiAgentSheet } from "./ai-agents/CreateAiAgentSheet";

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  linkedin: "LinkedIn",
  instagram: "Instagram",
};

const MODULE_LABEL: Record<string, string> = { crm: "CRM", ats: "ATS" };

export function AiAgentsSection({ initialAgents }: { initialAgents: AiAgentListItem[] }) {
  const [agents, setAgents] = useState(initialAgents);
  const [createOpen, setCreateOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleToggleStatus(agent: AiAgentListItem) {
    const nextStatus = agent.status === "active" ? "inactive" : "active";
    startTransition(async () => {
      try {
        await toggleAiAgentStatus(agent.id, nextStatus);
        setAgents((prev) => prev.map((a) => (a.id === agent.id ? { ...a, status: nextStatus } : a)));
        toast.success(nextStatus === "active" ? "Agente activado." : "Agente desactivado.");
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
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-semibold text-foreground">Agentes IA</h2>
          <p className="text-sm text-neutral-500">Asistentes de IA especializados que responden conversaciones de WhatsApp.</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Sparkles size={15} aria-hidden="true" />
          Nuevo agente
        </Button>
      </div>

      {agents.length === 0 ? (
        <EmptyState icon={Sparkles} title="Sin agentes IA todavía" description="Creá el primero para empezar a automatizar conversaciones." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-default text-xs uppercase text-neutral-500">
                <th className="px-4 py-3 font-medium">Agente</th>
                <th className="px-4 py-3 font-medium">Módulo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Canal</th>
                <th className="px-4 py-3 font-medium">Modelo</th>
                <th className="px-4 py-3 font-medium">Modo</th>
                <th className="px-4 py-3 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.id} className="border-b border-border-default last:border-b-0 hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <Link href={`/crm/ai-agents/${a.id}`} className="block min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{a.name}</p>
                      {a.description && <p className="truncate text-xs text-neutral-500">{a.description}</p>}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-xs text-neutral-500">{MODULE_LABEL[a.moduleKey] ?? a.moduleKey}</td>
                  <td className="px-4 py-3">
                    <Badge variant={a.status === "active" ? "success" : "neutral"}>{a.status === "active" ? "Activo" : "Inactivo"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {a.channels.length === 0 ? (
                        <span className="text-xs text-neutral-400">Sin canal</span>
                      ) : (
                        a.channels.map((c) => (
                          <Badge key={c} variant={c === "whatsapp" ? "accent" : "neutral"}>
                            {CHANNEL_LABEL[c] ?? c}
                          </Badge>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-neutral-600">{a.model}</td>
                  <td className="px-4 py-3">
                    <Badge variant={a.responseMode === "auto" ? "accent" : "warning"}>{a.responseMode === "auto" ? "Auto" : "Asistido"}</Badge>
                  </td>
                  <td className="px-4 py-3">
                    <DropdownMenu
                      trigger={<MoreVertical size={16} aria-hidden="true" />}
                      triggerLabel="Más opciones"
                      items={[
                        { label: "Ver detalle", icon: <Eye size={14} />, onSelect: () => (window.location.href = `/crm/ai-agents/${a.id}`) },
                        {
                          label: "Probar",
                          icon: <FlaskConical size={14} />,
                          onSelect: () => (window.location.href = `/crm/ai-agents/${a.id}?tab=pruebas`),
                        },
                        {
                          label: "Ver estadísticas",
                          icon: <BarChart3 size={14} />,
                          onSelect: () => (window.location.href = `/crm/ai-agents/${a.id}?tab=metricas`),
                        },
                        { label: "Duplicar", icon: <Copy size={14} />, onSelect: () => handleDuplicate(a), disabled: isPending },
                        {
                          label: a.status === "active" ? "Desactivar" : "Activar",
                          icon: a.status === "active" ? <PowerOff size={14} /> : <Power size={14} />,
                          onSelect: () => handleToggleStatus(a),
                          disabled: isPending,
                        },
                        { label: "Eliminar", icon: <Trash2 size={14} />, onSelect: () => handleDelete(a), destructive: true, disabled: isPending },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen && <CreateAiAgentSheet onClose={() => setCreateOpen(false)} />}
    </div>
  );
}
