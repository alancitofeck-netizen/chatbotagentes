"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/toast/toast";
import { cn } from "@/lib/utils/cn";
import { CLASSROOM_COLOR_KEYS, CLASSROOM_COLOR_META, COURSE_LEVEL_META } from "@/components/classroom/colorMeta";
import type { ClassroomCategory, ClassroomColor } from "@/lib/classroom/categories/queries";
import type { CourseLevel } from "@/lib/classroom/courses/queries";
import { createClassroomCourse, updateClassroomCourse } from "@/lib/classroom/courses/actions";

const LEVELS: CourseLevel[] = ["beginner", "intermediate", "advanced"];

/** Create-a-course form — same "create bare, upload cover after, then
 * update" two-step flow as GroupFormDialog.tsx, since a cover upload needs a
 * real entityId first. On success, navigates straight into the course
 * editor (ContentTab) so the owner/admin can start adding chapters/lessons
 * immediately. */
export function NewCourseSheet({ open, categories, onClose }: { open: boolean; categories: ClassroomCategory[]; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState<CourseLevel>("beginner");
  const [color, setColor] = useState<ClassroomColor>("accent");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !categoryId) return;

    startTransition(async () => {
      try {
        const input = { title, categoryId, description, objectives: [], coverImageUrl: null, color, level };
        const { id } = await createClassroomCourse(input);

        if (coverFile) {
          const body = new FormData();
          body.append("file", coverFile);
          body.append("entityId", id);
          const res = await fetch("/api/classroom/covers", { method: "POST", body });
          if (res.ok) {
            const { url } = (await res.json()) as { url: string };
            await updateClassroomCourse(id, { ...input, coverImageUrl: url });
          }
        }

        toast.success("Curso creado.");
        onClose();
        router.push(`/classroom/admin/cursos/${id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear el curso.");
      }
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nuevo curso">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Portada (opcional)</span>
          <label className="flex h-20 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong text-sm text-neutral-500 hover:border-accent-500 hover:text-accent-600">
            {coverFile ? coverFile.name : "Subir portada"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)} />
          </label>
        </div>

        <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />

        <Select label="Categoría" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </Select>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="course-description">
            Descripción
          </label>
          <textarea
            id="course-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="resize-none rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Nivel</span>
          <div className="flex gap-2">
            {LEVELS.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLevel(l)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-[13px] font-medium",
                  level === l ? "border-accent-500 bg-accent-100 text-accent-700" : "border-border-default text-neutral-500 hover:bg-surface-2",
                )}
              >
                {COURSE_LEVEL_META[l].label}
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
                onClick={() => setColor(key)}
                title={CLASSROOM_COLOR_META[key].label}
                className={cn("flex size-8 items-center justify-center rounded-full border-2", color === key ? "border-foreground" : "border-transparent")}
              >
                <span className={cn("size-5 rounded-full", CLASSROOM_COLOR_META[key].dot)} />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPending} disabled={!categories.length}>
            Crear curso
          </Button>
        </div>
        {!categories.length && <p className="text-xs text-warning">Creá al menos una categoría primero.</p>}
      </form>
    </Sheet>
  );
}
