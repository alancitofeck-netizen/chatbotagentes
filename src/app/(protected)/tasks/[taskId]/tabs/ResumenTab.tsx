"use client";

import { useState } from "react";
import { Briefcase, FileText, MessageCircle, Plus, ShieldCheck, Trash2, User, CalendarDays } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { OpportunityOption } from "@/lib/crm/queries";
import type { RelationEntityType, TaskDetail, TaskOption } from "@/lib/tasks/queries";
import { addChecklistItem, addTaskRelation, deleteChecklistItem, removeTaskRelation, toggleChecklistItem } from "@/lib/tasks/actions";
import { BlockEditor } from "@/components/tasks/BlockEditor/BlockEditor";

const RELATION_TYPE_META: Record<RelationEntityType, { label: string; icon: LucideIcon }> = {
  contact: { label: "Contacto/Cliente", icon: User },
  conversation: { label: "Conversación", icon: MessageCircle },
  opportunity: { label: "Oportunidad/Pipeline", icon: Briefcase },
  advisor_policy: { label: "Póliza", icon: ShieldCheck },
  event: { label: "Evento", icon: CalendarDays },
  document: { label: "Documento", icon: FileText },
};

/** "Resumen" tab — the document-like main body (Sección 3 del rediseño):
 * editor de bloques + checklist + panel de relaciones all live together
 * here, since Notion treats these as one continuous page rather than
 * separate tabs. Comentarios/Archivos/Actividad are the real separate tabs. */
export function ResumenTab({
  task,
  onTaskChange,
  contactOptions,
  conversationOptions,
  opportunityOptions,
  advisorPolicyOptions,
  eventOptions,
  documentOptions,
}: {
  task: TaskDetail;
  onTaskChange: (updater: (prev: TaskDetail) => TaskDetail) => void;
  contactOptions: TaskOption[];
  conversationOptions: TaskOption[];
  opportunityOptions: OpportunityOption[];
  advisorPolicyOptions: TaskOption[];
  eventOptions: TaskOption[];
  documentOptions: TaskOption[];
}) {
  const [newChecklistTitle, setNewChecklistTitle] = useState("");
  const [addingChecklistItem, setAddingChecklistItem] = useState(false);
  const [relationType, setRelationType] = useState<RelationEntityType>("contact");
  const [relationTarget, setRelationTarget] = useState("");
  const [addingRelation, setAddingRelation] = useState(false);

  const optionsByType: Record<RelationEntityType, TaskOption[]> = {
    contact: contactOptions,
    conversation: conversationOptions,
    opportunity: opportunityOptions,
    advisor_policy: advisorPolicyOptions,
    event: eventOptions,
    document: documentOptions,
  };

  async function handleAddChecklistItem() {
    const title = newChecklistTitle.trim();
    if (!title) return;
    setAddingChecklistItem(true);
    try {
      await addChecklistItem(task.id, title);
      onTaskChange((prev) => ({
        ...prev,
        checklist: [...prev.checklist, { id: crypto.randomUUID(), title, isCompleted: false, position: prev.checklist.length }],
      }));
      setNewChecklistTitle("");
    } finally {
      setAddingChecklistItem(false);
    }
  }

  async function handleToggleChecklistItem(itemId: string, isCompleted: boolean) {
    onTaskChange((prev) => ({
      ...prev,
      checklist: prev.checklist.map((c) => (c.id === itemId ? { ...c, isCompleted } : c)),
      checklistDone: prev.checklistDone + (isCompleted ? 1 : -1),
    }));
    await toggleChecklistItem(itemId, task.id, isCompleted);
  }

  async function handleDeleteChecklistItem(itemId: string) {
    const item = task.checklist.find((c) => c.id === itemId);
    onTaskChange((prev) => ({
      ...prev,
      checklist: prev.checklist.filter((c) => c.id !== itemId),
      checklistTotal: prev.checklistTotal - 1,
      checklistDone: prev.checklistDone - (item?.isCompleted ? 1 : 0),
    }));
    await deleteChecklistItem(itemId, task.id);
  }

  async function handleAddRelation() {
    if (!relationTarget) return;
    setAddingRelation(true);
    try {
      const options = optionsByType[relationType];
      const label = options.find((o) => o.id === relationTarget)?.label ?? "—";
      await addTaskRelation(task.id, relationType, relationTarget);
      onTaskChange((prev) => ({
        ...prev,
        relations: [...prev.relations, { id: crypto.randomUUID(), type: relationType, relatedId: relationTarget, label }],
      }));
      setRelationTarget("");
      toast.success("Relación agregada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo agregar la relación.");
    } finally {
      setAddingRelation(false);
    }
  }

  async function handleRemoveRelation(relationId: string) {
    onTaskChange((prev) => ({ ...prev, relations: prev.relations.filter((r) => r.id !== relationId) }));
    await removeTaskRelation(relationId, task.id);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="mb-2 text-[13px] font-semibold text-foreground">Descripción</h2>
        <BlockEditor taskId={task.id} initialJson={task.descriptionJson} />
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-foreground">
            Checklist {task.checklist.length > 0 && `(${task.checklist.filter((c) => c.isCompleted).length}/${task.checklist.length})`}
          </h2>
        </div>
        <div className="flex flex-col gap-1.5">
          {task.checklist
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((item) => (
              <div key={item.id} className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2">
                <input
                  type="checkbox"
                  checked={item.isCompleted}
                  onChange={(e) => handleToggleChecklistItem(item.id, e.target.checked)}
                  className="size-4 shrink-0 rounded border-border-strong accent-[var(--color-accent-500)]"
                />
                <span className={`flex-1 text-sm ${item.isCompleted ? "text-neutral-400 line-through" : "text-foreground"}`}>{item.title}</span>
                <button
                  type="button"
                  onClick={() => handleDeleteChecklistItem(item.id)}
                  aria-label="Eliminar ítem"
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 size={13} className="text-neutral-400 hover:text-error-strong" aria-hidden="true" />
                </button>
              </div>
            ))}
          <div className="flex items-center gap-2 px-2">
            <Plus size={14} className="text-neutral-400" aria-hidden="true" />
            <input
              value={newChecklistTitle}
              onChange={(e) => setNewChecklistTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddChecklistItem()}
              placeholder="Agregar un ítem…"
              disabled={addingChecklistItem}
              className="flex-1 bg-transparent py-1.5 text-sm text-foreground outline-none placeholder:text-neutral-400"
            />
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-[13px] font-semibold text-foreground">Relacionado con</h2>
        <div className="flex flex-col gap-2">
          {task.relations.length === 0 && <p className="text-sm text-neutral-500">Sin relaciones todavía.</p>}
          {task.relations.map((r) => {
            const Icon = RELATION_TYPE_META[r.type].icon;
            return (
              <div key={r.id} className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2">
                <Icon size={14} className="shrink-0 text-neutral-500" aria-hidden="true" />
                <span className="flex-1 truncate text-sm text-foreground">{r.label}</span>
                <span className="shrink-0 text-[11px] text-neutral-400">{RELATION_TYPE_META[r.type].label}</span>
                <button type="button" onClick={() => handleRemoveRelation(r.id)} aria-label="Quitar relación">
                  <Trash2 size={13} className="text-neutral-400 hover:text-error-strong" aria-hidden="true" />
                </button>
              </div>
            );
          })}
          <div className="flex flex-wrap items-end gap-2">
            <Select
              label="Tipo"
              value={relationType}
              onChange={(e) => {
                setRelationType(e.target.value as RelationEntityType);
                setRelationTarget("");
              }}
              containerClassName="w-52"
            >
              {(Object.entries(RELATION_TYPE_META) as [RelationEntityType, (typeof RELATION_TYPE_META)[RelationEntityType]][]).map(
                ([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ),
              )}
            </Select>
            <Select label="Registro" value={relationTarget} onChange={(e) => setRelationTarget(e.target.value)} containerClassName="flex-1">
              <option value="">Elegir…</option>
              {optionsByType[relationType].map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </Select>
            <Button size="sm" onClick={handleAddRelation} loading={addingRelation} disabled={!relationTarget}>
              Agregar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
