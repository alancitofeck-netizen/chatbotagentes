"use client";

import { useEffect, useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { createAutomation, getPipelineStageOptionsAction, type AutomationInput } from "@/lib/automations/actions";
import { getWorkspaceMembersListAction } from "@/lib/settings/actions";
import type { PipelineStageOption } from "@/lib/automations/queries";
import type { WorkspaceMember } from "@/lib/settings/queries";
import type { AutomationActionType, AutomationTriggerType } from "@/lib/automations/queries";

export function CreateAutomationSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>("keyword");
  const [keyword, setKeyword] = useState("");
  const [actionType, setActionType] = useState<AutomationActionType>("send_text");
  const [responseBody, setResponseBody] = useState("");
  const [opportunityTitle, setOpportunityTitle] = useState("");
  const [opportunityValue, setOpportunityValue] = useState("");
  const [stageId, setStageId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueInHours, setDueInHours] = useState("");
  const [stages, setStages] = useState<PipelineStageOption[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isPending, startTransition] = useTransition();

  // Both option lists are cheap workspace-wide lookups (no per-automation
  // scoping needed) — fetched once when the sheet opens rather than eagerly
  // on every Automations page load.
  useEffect(() => {
    if (!open) return;
    getPipelineStageOptionsAction().then(setStages);
    getWorkspaceMembersListAction().then(setMembers);
  }, [open]);

  function reset() {
    setName("");
    setTriggerType("keyword");
    setKeyword("");
    setActionType("send_text");
    setResponseBody("");
    setOpportunityTitle("");
    setOpportunityValue("");
    setStageId("");
    setTaskTitle("");
    setAssignedTo("");
    setDueInHours("");
  }

  function handleCreate() {
    const input: AutomationInput = {
      name,
      triggerType,
      keyword,
      actionType,
      responseBody,
      opportunityTitle,
      opportunityValue: opportunityValue ? Number(opportunityValue) : undefined,
      stageId,
      taskTitle,
      assignedTo: assignedTo || null,
      dueInHours: dueInHours ? Number(dueInHours) : undefined,
    };
    startTransition(async () => {
      try {
        await createAutomation(input);
        toast.success("Automatización creada.");
        reset();
        onCreated();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear la automatización.");
      }
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nueva automatización">
      <div className="flex flex-col gap-4 p-5">
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Saludo inicial" />

        <Select label="Cuándo" value={triggerType} onChange={(e) => setTriggerType(e.target.value as AutomationTriggerType)}>
          <option value="keyword">El mensaje contiene una palabra clave</option>
          <option value="any_message">Cualquier mensaje del contacto (además de la respuesta de la IA)</option>
        </Select>

        {triggerType === "keyword" && (
          <Input label="Palabra clave" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Ej. horarios" />
        )}

        <Select label="Acción" value={actionType} onChange={(e) => setActionType(e.target.value as AutomationActionType)}>
          <option value="send_text">Enviar un texto</option>
          <option value="create_opportunity">Crear oportunidad</option>
          <option value="change_pipeline_stage">Cambiar etapa del pipeline</option>
          <option value="assign_task">Asignar tarea</option>
        </Select>

        {actionType === "send_text" && (
          <Input
            label="Texto de respuesta"
            value={responseBody}
            onChange={(e) => setResponseBody(e.target.value)}
            placeholder="Texto que se enviaría por WhatsApp"
          />
        )}

        {actionType === "create_opportunity" && (
          <>
            <Input label="Título de la oportunidad" value={opportunityTitle} onChange={(e) => setOpportunityTitle(e.target.value)} />
            <Input
              label="Valor (opcional)"
              type="number"
              value={opportunityValue}
              onChange={(e) => setOpportunityValue(e.target.value)}
            />
          </>
        )}

        {actionType === "change_pipeline_stage" && (
          <Select label="Etapa destino" value={stageId} onChange={(e) => setStageId(e.target.value)}>
            <option value="">Elegí una etapa…</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}

        {actionType === "assign_task" && (
          <>
            <Input label="Título de la tarea" value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} />
            <Select label="Asignar a (opcional)" value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)}>
              <option value="">Sin asignar</option>
              {members.map((m) => (
                <option key={m.memberId} value={m.memberId}>
                  {m.fullName}
                </option>
              ))}
            </Select>
            <Input
              label="Vencimiento en horas (opcional)"
              type="number"
              value={dueInHours}
              onChange={(e) => setDueInHours(e.target.value)}
            />
          </>
        )}

        <Button onClick={handleCreate} loading={isPending}>
          Crear automatización
        </Button>
      </div>
    </Sheet>
  );
}
