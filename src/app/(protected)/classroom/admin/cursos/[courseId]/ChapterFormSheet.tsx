"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { ClassroomChapter } from "@/lib/classroom/curriculum/queries";

/** Create/edit a chapter — a single-field Sheet form, same pattern as every
 * other Sheet-based dialog in this app. create/update are passed in as
 * props rather than imported directly since the create call needs
 * courseId (already known by the parent, AdminChapterLessonTree). The
 * parent conditionally mounts this component (not an always-mounted
 * open-boolean), same as GroupFormDialog — so `chapter`'s initial value is
 * always fresh on open, with no prop-syncing effect needed. */
export function ChapterFormSheet({
  chapter,
  onClose,
  onSaved,
  createAction,
  updateAction,
}: {
  chapter: ClassroomChapter | null;
  onClose: () => void;
  onSaved: () => void;
  createAction: (title: string) => Promise<{ id: string }>;
  updateAction: (chapterId: string, title: string) => Promise<void>;
}) {
  const [title, setTitle] = useState(chapter?.title ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    startTransition(async () => {
      try {
        if (chapter) await updateAction(chapter.id, title);
        else await createAction(title);
        onSaved();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar el capítulo.");
      }
    });
  }

  return (
    <Sheet open onClose={onClose} title={chapter ? "Editar capítulo" : "Nuevo capítulo"} className="max-w-sm">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            {chapter ? "Guardar cambios" : "Crear capítulo"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
