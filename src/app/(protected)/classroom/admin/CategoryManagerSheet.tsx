"use client";

import { useState, useTransition } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, ImagePlus, X } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/toast/toast";
import { cn } from "@/lib/utils/cn";
import { CLASSROOM_COLOR_KEYS, CLASSROOM_COLOR_META, CLASSROOM_ICON_PRESETS } from "@/components/classroom/colorMeta";
import type { ClassroomCategory, ClassroomColor } from "@/lib/classroom/categories/queries";
import {
  createClassroomCategory,
  updateClassroomCategory,
  deleteClassroomCategory,
  reorderClassroomCategories,
} from "@/lib/classroom/categories/actions";

type FormState = {
  id: string | null;
  name: string;
  description: string;
  icon: string;
  color: ClassroomColor;
  coverImageUrl: string | null;
  isVisible: boolean;
};

const EMPTY_FORM: FormState = { id: null, name: "", description: "", icon: "📚", color: "accent", coverImageUrl: null, isVisible: true };

function CategoryRow({ category, onEdit, onDelete }: { category: ClassroomCategory; onEdit: () => void; onDelete: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: category.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const colorMeta = CLASSROOM_COLOR_META[category.color];

  return (
    <li ref={setNodeRef} style={style} className="group/row flex items-center gap-2 rounded-md px-2 py-2 hover:bg-surface-2">
      <button
        {...attributes}
        {...listeners}
        type="button"
        aria-label="Reordenar categoría"
        className="cursor-grab text-neutral-300 hover:text-neutral-500 active:cursor-grabbing"
      >
        <GripVertical size={14} aria-hidden="true" />
      </button>
      <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-md text-[15px]", colorMeta.bg)}>{category.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{category.name}</p>
        {!category.isVisible && <p className="text-xs text-neutral-400">Oculta</p>}
      </div>
      <button type="button" onClick={onEdit} className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground">
        <Pencil size={14} aria-hidden="true" />
      </button>
      <button type="button" onClick={onDelete} className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong">
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </li>
  );
}

/** Full CRUD + drag-reorder for classroom_categories in one Sheet — list view
 * with an inline create/edit form toggle, same "Sheet-based single-form"
 * convention as GroupFormDialog.tsx, plus the single-level dnd-kit reorder
 * pattern from TasksSidebar.tsx (no nested chapters/lessons here, so no need
 * for AdminChapterLessonTree's 2-level version). */
export function CategoryManagerSheet({
  open,
  categories,
  onClose,
  onChanged,
}: {
  open: boolean;
  categories: ClassroomCategory[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [items, setItems] = useState(categories);
  const [prevCategories, setPrevCategories] = useState(categories);
  const [form, setForm] = useState<FormState | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // "Adjusting state when a prop changes" during render (React's own
  // recommended alternative to a setState-in-effect sync) — categories
  // legitimately changes while this Sheet stays mounted (router.refresh()
  // after any mutation), unlike the single-item forms elsewhere in this
  // module which remount instead.
  if (categories !== prevCategories) {
    setPrevCategories(categories);
    setItems(categories);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((prev) => {
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      startTransition(async () => {
        try {
          await reorderClassroomCategories(next.map((c) => c.id));
          onChanged();
        } catch {
          toast.error("No se pudo reordenar.");
        }
      });
      return next;
    });
  }

  async function handleCoverChange(file: File | null) {
    if (!form || !file) return;
    const body = new FormData();
    body.append("file", file);
    body.append("entityId", form.id ?? "pending");
    const res = await fetch("/api/classroom/covers", { method: "POST", body });
    if (!res.ok) {
      toast.error("No se pudo subir la imagen.");
      return;
    }
    const { url } = (await res.json()) as { url: string };
    setForm((f) => (f ? { ...f, coverImageUrl: url } : f));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form || !form.name.trim()) return;
    startTransition(async () => {
      try {
        if (form.id) {
          await updateClassroomCategory(form.id, {
            name: form.name,
            description: form.description,
            icon: form.icon,
            color: form.color,
            coverImageUrl: form.coverImageUrl,
            isVisible: form.isVisible,
          });
          toast.success("Categoría actualizada.");
        } else {
          await createClassroomCategory({
            name: form.name,
            description: form.description,
            icon: form.icon,
            color: form.color,
            coverImageUrl: form.coverImageUrl,
            isVisible: form.isVisible,
          });
          toast.success("Categoría creada.");
        }
        setForm(null);
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar la categoría.");
      }
    });
  }

  function handleDelete() {
    if (!confirmDeleteId) return;
    startTransition(async () => {
      try {
        await deleteClassroomCategory(confirmDeleteId);
        setConfirmDeleteId(null);
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
        setConfirmDeleteId(null);
      }
    });
  }

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Categorías" className="max-w-lg">
        {form ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Portada (opcional)</span>
              {form.coverImageUrl ? (
                <div className="relative h-24 w-full overflow-hidden rounded-lg border border-border-default">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local preview or remote Storage URL */}
                  <img src={form.coverImageUrl} alt="Portada" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setForm((f) => (f ? { ...f, coverImageUrl: null } : f))}
                    aria-label="Quitar portada"
                    className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-neutral-950/60 text-white hover:bg-neutral-950/80"
                  >
                    <X size={13} aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <label className="flex h-16 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong text-sm text-neutral-500 hover:border-accent-500 hover:text-accent-600">
                  <ImagePlus size={16} aria-hidden="true" />
                  Subir portada
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverChange(e.target.files?.[0] ?? null)} />
                </label>
              )}
            </div>

            <Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus />

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground" htmlFor="category-description">
                Descripción
              </label>
              <textarea
                id="category-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                className="resize-none rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Ícono</span>
              <div className="flex flex-wrap gap-1.5">
                {CLASSROOM_ICON_PRESETS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    onClick={() => setForm({ ...form, icon })}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md border text-[15px]",
                      form.icon === icon ? "border-accent-500 bg-accent-100" : "border-border-default hover:bg-surface-2",
                    )}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Color</span>
              <div className="flex gap-2">
                {CLASSROOM_COLOR_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setForm({ ...form, color: key })}
                    title={CLASSROOM_COLOR_META[key].label}
                    className={cn("flex size-8 items-center justify-center rounded-full border-2", form.color === key ? "border-foreground" : "border-transparent")}
                  >
                    <span className={cn("size-5 rounded-full", CLASSROOM_COLOR_META[key].dot)} />
                  </button>
                ))}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={form.isVisible} onChange={(e) => setForm({ ...form, isVisible: e.target.checked })} className="accent-accent-500" />
              Visible para todos los usuarios
            </label>

            <div className="mt-2 flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setForm(null)} disabled={isPending}>
                Cancelar
              </Button>
              <Button type="submit" loading={isPending}>
                {form.id ? "Guardar cambios" : "Crear categoría"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-2 p-5">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <ul className="flex flex-col gap-0.5">
                  {items.map((c) => (
                    <CategoryRow
                      key={c.id}
                      category={c}
                      onEdit={() =>
                        setForm({
                          id: c.id,
                          name: c.name,
                          description: c.description ?? "",
                          icon: c.icon,
                          color: c.color,
                          coverImageUrl: c.coverImageUrl,
                          isVisible: c.isVisible,
                        })
                      }
                      onDelete={() => setConfirmDeleteId(c.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
            <Button type="button" variant="secondary" onClick={() => setForm(EMPTY_FORM)} className="mt-2 self-start">
              Nueva categoría
            </Button>
          </div>
        )}
      </Sheet>

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        title="Eliminar categoría"
        description="Esta acción no se puede deshacer. Los cursos en esta categoría deben moverse o eliminarse primero."
        isLoading={isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </>
  );
}
