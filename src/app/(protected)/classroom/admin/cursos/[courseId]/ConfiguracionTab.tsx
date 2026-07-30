"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ImagePlus, X } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/toast/toast";
import { cn } from "@/lib/utils/cn";
import { CLASSROOM_COLOR_KEYS, CLASSROOM_COLOR_META, COURSE_LEVEL_META } from "@/components/classroom/colorMeta";
import type { ClassroomCategory, ClassroomColor } from "@/lib/classroom/categories/queries";
import type { ClassroomCourse, CourseLevel } from "@/lib/classroom/courses/queries";
import { updateClassroomCourse, deleteClassroomCourse, setClassroomCourseStatus } from "@/lib/classroom/courses/actions";

const LEVELS: CourseLevel[] = ["beginner", "intermediate", "advanced"];

/** Mirrors mini-apps' own ConfiguracionTab.tsx — a single metadata-editing
 * form for an already-created entity, plus the publish/delete lifecycle
 * actions that don't belong in the create form. */
export function ConfiguracionTab({ course, categories }: { course: ClassroomCourse; categories: ClassroomCategory[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(course.title);
  const [categoryId, setCategoryId] = useState(course.categoryId);
  const [description, setDescription] = useState(course.description ?? "");
  const [objectives, setObjectives] = useState(course.objectives.join("\n"));
  const [level, setLevel] = useState<CourseLevel>(course.level);
  const [color, setColor] = useState<ClassroomColor>(course.color);
  const [coverImageUrl, setCoverImageUrl] = useState(course.coverImageUrl);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleCoverChange(file: File | null) {
    if (!file) return;
    const body = new FormData();
    body.append("file", file);
    body.append("entityId", course.id);
    const res = await fetch("/api/classroom/covers", { method: "POST", body });
    if (!res.ok) {
      toast.error("No se pudo subir la imagen.");
      return;
    }
    const { url } = (await res.json()) as { url: string };
    setCoverImageUrl(url);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateClassroomCourse(course.id, {
          title,
          categoryId,
          description,
          objectives: objectives.split("\n"),
          coverImageUrl,
          color,
          level,
        });
        toast.success("Curso actualizado.");
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar el curso.");
      }
    });
  }

  function handleTogglePublish() {
    startTransition(async () => {
      try {
        await setClassroomCourseStatus(course.id, course.status === "published" ? "draft" : "published");
        toast.success(course.status === "published" ? "Curso pasado a borrador." : "Curso publicado.");
        router.refresh();
      } catch {
        toast.error("No se pudo actualizar el estado.");
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteClassroomCourse(course.id);
        toast.success("Curso eliminado.");
        router.push("/classroom/admin");
      } catch {
        toast.error("No se pudo eliminar el curso.");
        setConfirmDelete(false);
      }
    });
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="flex max-w-xl flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Portada</span>
          {coverImageUrl ? (
            <div className="relative h-32 w-full overflow-hidden rounded-lg border border-border-default">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote Storage URL, dimensions dynamic */}
              <img src={coverImageUrl} alt="Portada" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setCoverImageUrl(null)}
                aria-label="Quitar portada"
                className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-neutral-950/60 text-white hover:bg-neutral-950/80"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <label className="flex h-20 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong text-sm text-neutral-500 hover:border-accent-500 hover:text-accent-600">
              <ImagePlus size={16} aria-hidden="true" />
              Subir portada
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverChange(e.target.files?.[0] ?? null)} />
            </label>
          )}
        </div>

        <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} required />

        <Select label="Categoría" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.icon} {c.name}
            </option>
          ))}
        </Select>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="course-config-description">
            Descripción
          </label>
          <textarea
            id="course-config-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="resize-none rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="course-config-objectives">
            Objetivos (uno por línea)
          </label>
          <textarea
            id="course-config-objectives"
            value={objectives}
            onChange={(e) => setObjectives(e.target.value)}
            rows={4}
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

        <div className="flex justify-end">
          <Button type="submit" loading={isPending}>
            Guardar cambios
          </Button>
        </div>
      </form>

      <div className="mt-8 flex max-w-xl flex-col gap-3 border-t border-border-default pt-6">
        <h3 className="text-sm font-semibold text-foreground">Zona de riesgo</h3>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={handleTogglePublish} disabled={isPending}>
            {course.status === "published" ? "Pasar a borrador" : "Publicar curso"}
          </Button>
          <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)}>
            Eliminar curso
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar curso"
        description="Se eliminarán todos sus capítulos, lecciones, recursos y comentarios. Esta acción no se puede deshacer."
        isLoading={isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
