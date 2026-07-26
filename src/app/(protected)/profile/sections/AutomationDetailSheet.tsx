"use client";

import { useEffect, useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { AutomationListItem, AutomationActionType, AutomationTriggerType, PipelineStageOption } from "@/lib/automations/queries";
import { deleteAutomation, updateAutomation, getPipelineStageOptionsAction, type AutomationInput } from "@/lib/automations/actions";
import { getWorkspaceMembersListAction } from "@/lib/settings/actions";
import type { WorkspaceMember } from "@/lib/settings/queries";

/** `automation` comes already loaded from the list (no async detail fetch),
 * so — same as BookingDetailSheet — there's no loading→loaded race to guard
 * against with a remount key beyond the id itself (handled by the parent). */
export function AutomationDetailSheet({
  automation,
  onClose,
  onChanged,
}: {
  automation: AutomationListItem | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  if (!automation) return null;
  return <AutomationDetailContent automation={automation} onClose={onClose} onChanged={onChanged} />;
}

function AutomationDetailContent({
  automation,
  onClose,
  onChanged,
}: {
  automation: AutomationListItem;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState(automation.name);
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>(automation.triggerType);
  const [keyword, setKeyword] = useState(automation.triggerKeyword ?? "");
  const [actionType, setActionType] = useState<AutomationActionType>(automation.actionType);
  const [responseBody, setResponseBody] = useState(automation.actionBody ?? "");
  const [opportunityTitle, setOpportunityTitle] = useState(automation.actionTitle ?? "");
  const [opportunityValue, setOpportunityValue] = useState(automation.actionValue != null ? String(automation.actionValue) : "");
  const [stageId, setStageId] = useState(automation.actionStageId ?? "");
  const [taskTitle, setTaskTitle] = useState(automation.actionTaskTitle ?? "");
  const [assignedTo, setAssignedTo] = useState(automation.actionAssignedTo ?? "");
  const [dueInHours, setDueInHours] = useState(automation.actionDueInHours != null ? String(automation.actionDueInHours) : "");
  const [stages, setStages] = useState<PipelineStageOption[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getPipelineStageOptionsAction().then(setStages);
    getWorkspaceMembersListAction().then(setMembers);
  }, []);

  function handleSave() {
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
        await updateAutomation(automation.id, input);
        toast.success("Automatización actualizada.");
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar la automatización.");
      }
    });
  }

  function handleDelete() {
    if (!window.confirm(`¿Eliminar la automatización "${automation.name}"?`)) return;
    startTransition(async () => {
      await deleteAutomation(automation.id);
      toast.success("Automatización eliminada.");
      onChanged();
    });
  }

  return (
    <Sheet open onClose={onClose} title={automation.name}>
      <div className="flex flex-col gap-4 p-5">
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />

        <Select label="Cuándo" value={triggerType} onChange={(e) => setTriggerType(e.target.value as AutomationTriggerType)}>
          <option value="keyword">El mensaje contiene una palabra clave</option>
          <option value="any_message">Cualquier mensaje del contacto (además de la respuesta de la IA)</option>
        </Select>

        {triggerType === "keyword" && <Input label="Palabra clave" value={keyword} onChange={(e) => setKeyword(e.target.value)} />}

        <Select label="Acción" value={actionType} onChange={(e) => setActionType(e.target.value as AutomationActionType)}>
          <option value="send_text">Enviar un texto</option>
          <option value="create_opportunity">Crear oportunidad</option>
          <option value="change_pipeline_stage">Cambiar etapa del pipeline</option>
          <option value="assign_task">Asignar tarea</option>
        </Select>

        {actionType === "send_text" && (
          <Input label="Texto de respuesta" value={responseBody} onChange={(e) => setResponseBody(e.target.value)} />
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

        <Button onClick={handleSave} loading={isPending}>
          Guardar cambios
        </Button>
        <Button variant="destructive" onClick={handleDelete} loading={isPending}>
          Eliminar
        </Button>
      </div>
    </Sheet>
  );
}
