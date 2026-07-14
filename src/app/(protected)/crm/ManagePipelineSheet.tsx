"use client";

import { useState, useTransition } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/toast/toast";
import type { PipelineStage } from "@/lib/crm/queries";
import {
  renamePipeline,
  createPipelineStage,
  updatePipelineStage,
  deletePipelineStage,
  reorderPipelineStages,
} from "@/lib/crm/actions";

function StageRow({
  stage,
  onEdit,
  onDelete,
}: {
  stage: PipelineStage;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: stage.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-md border border-border-default bg-surface-1 px-3 py-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label="Reordenar etapa"
        className="cursor-grab text-neutral-400 hover:text-foreground active:cursor-grabbing"
      >
        <GripVertical size={15} aria-hidden="true" />
      </button>
      <span className="flex-1 truncate text-sm font-medium text-foreground">{stage.name}</span>
      {stage.isWon && <Badge variant="success">Ganado</Badge>}
      {stage.isLost && <Badge variant="neutral">Perdido</Badge>}
      <button type="button" onClick={onEdit} className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2 hover:text-foreground">
        <Pencil size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong"
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </li>
  );
}

/** "Gestionar pipeline" — the Blueprint (06-crm.md) explicitly designs stages
 * as customizable per workspace, but no UI ever existed for it. Reuses the
 * same @dnd-kit primitives already in the project (src/components/kanban/
 * KanbanBoard.tsx) for a much simpler single-axis sortable list. */
export function ManagePipelineSheet({
  pipelineId,
  pipelineName,
  stages,
  onClose,
  onChanged,
}: {
  pipelineId: string;
  pipelineName: string;
  stages: PipelineStage[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [name, setName] = useState(pipelineName);
  const [orderedStages, setOrderedStages] = useState(stages);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIsWon, setEditIsWon] = useState(false);
  const [editIsLost, setEditIsLost] = useState(false);
  const [newStageName, setNewStageName] = useState("");
  const [isPending, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function handleRename() {
    if (!name.trim() || name.trim() === pipelineName) return;
    startTransition(async () => {
      try {
        await renamePipeline(pipelineId, name);
        toast.success("Pipeline renombrado.");
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo renombrar el pipeline.");
      }
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setOrderedStages((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      const next = arrayMove(prev, oldIndex, newIndex);
      startTransition(async () => {
        await reorderPipelineStages(next.map((s) => s.id));
        onChanged();
      });
      return next;
    });
  }

  function startEdit(stage: PipelineStage) {
    setEditingStageId(stage.id);
    setEditName(stage.name);
    setEditIsWon(stage.isWon);
    setEditIsLost(stage.isLost);
  }

  function handleSaveEdit() {
    if (!editingStageId) return;
    startTransition(async () => {
      try {
        await updatePipelineStage(editingStageId, { name: editName, isWon: editIsWon, isLost: editIsLost });
        toast.success("Etapa actualizada.");
        setEditingStageId(null);
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar la etapa.");
      }
    });
  }

  function handleDeleteStage(stage: PipelineStage) {
    if (!window.confirm(`¿Eliminar la etapa "${stage.name}"?`)) return;
    startTransition(async () => {
      try {
        await deletePipelineStage(stage.id);
        toast.success("Etapa eliminada.");
        setOrderedStages((prev) => prev.filter((s) => s.id !== stage.id));
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo eliminar la etapa.");
      }
    });
  }

  function handleAddStage() {
    if (!newStageName.trim()) return;
    startTransition(async () => {
      try {
        await createPipelineStage(pipelineId, newStageName);
        setNewStageName("");
        toast.success("Etapa creada.");
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear la etapa.");
      }
    });
  }

  return (
    <Sheet open onClose={onClose} title="Gestionar pipeline">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-end gap-2">
          <Input label="Nombre del pipeline" value={name} onChange={(e) => setName(e.target.value)} containerClassName="flex-1" />
          <Button variant="secondary" size="sm" onClick={handleRename} loading={isPending}>
            Guardar
          </Button>
        </div>

        <div className="my-1 h-px bg-border-default" />
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Etapas</p>

        {editingStageId ? (
          <div className="flex flex-col gap-3 rounded-md border border-border-default bg-surface-2 p-3">
            <Input label="Nombre de la etapa" value={editName} onChange={(e) => setEditName(e.target.value)} />
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editIsWon} onChange={(e) => setEditIsWon(e.target.checked)} />
                Marca oportunidades como Ganadas
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={editIsLost} onChange={(e) => setEditIsLost(e.target.checked)} />
                Marca oportunidades como Perdidas
              </label>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEdit} loading={isPending}>
                Guardar etapa
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setEditingStageId(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={orderedStages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              <ul className="flex flex-col gap-2">
                {orderedStages.map((stage) => (
                  <StageRow
                    key={stage.id}
                    stage={stage}
                    onEdit={() => startEdit(stage)}
                    onDelete={() => handleDeleteStage(stage)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        )}

        <div className="flex items-end gap-2">
          <Input
            label="Nueva etapa"
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
            placeholder="Ej. Seguimiento"
            containerClassName="flex-1"
          />
          <Button variant="secondary" size="sm" onClick={handleAddStage} loading={isPending}>
            <Plus size={15} aria-hidden="true" />
            Agregar
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
