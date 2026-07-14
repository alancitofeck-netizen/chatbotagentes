"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/toast/toast";
import type { AiToolOption } from "@/lib/ai-agents/queries";
import { toggleAgentTool } from "@/lib/ai-agents/actions";

export function ToolsTab({ agentId, tools, initialToolIds }: { agentId: string; tools: AiToolOption[]; initialToolIds: string[] }) {
  const [toolIds, setToolIds] = useState(initialToolIds);
  const [isPending, startTransition] = useTransition();

  function handleToggle(toolId: string, enabled: boolean) {
    startTransition(async () => {
      try {
        await toggleAgentTool(agentId, toolId, enabled);
        setToolIds((prev) => (enabled ? [...prev, toolId] : prev.filter((id) => id !== toolId)));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar la tool.");
      }
    });
  }

  return (
    <Card>
      <CardHeader title="Funciones del CRM disponibles" />
      <p className="mb-3 text-sm text-neutral-500">Elegí qué puede hacer este agente además de conversar.</p>
      <div className="flex flex-col gap-2">
        {tools.map((t) => {
          const active = toolIds.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              disabled={isPending}
              onClick={() => handleToggle(t.id, !active)}
              className="flex items-center justify-between gap-3 rounded-md border border-border-default px-3 py-2 text-left hover:bg-surface-2 disabled:opacity-50"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{t.name}</p>
                {t.description && <p className="text-xs text-neutral-500">{t.description}</p>}
              </div>
              <Badge variant={active ? "accent" : "neutral"}>{active ? "Habilitada" : "Deshabilitada"}</Badge>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
