"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Settings, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/toast/toast";
import { CourseCard } from "@/components/classroom/CourseCard";
import type { ClassroomCategory } from "@/lib/classroom/categories/queries";
import type { ClassroomCourseCard } from "@/lib/classroom/courses/queries";
import { deleteClassroomCourse, setClassroomCourseStatus, toggleClassroomCourseFeatured } from "@/lib/classroom/courses/actions";
import { CategoryManagerSheet } from "./CategoryManagerSheet";
import { NewCourseSheet } from "./NewCourseSheet";

/** Owner/admin-only Classroom admin home — category management + the full
 * course grid (draft and published, unlike the learner home which only ever
 * shows published). Only reachable via /classroom/admin, gated by
 * admin/layout.tsx's role check. */
export function AdminClassroomShell({ categories, courses }: { categories: ClassroomCategory[]; courses: ClassroomCourseCard[] }) {
  const router = useRouter();
  const [showCategories, setShowCategories] = useState(false);
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function refreshCategories() {
    router.refresh();
  }

  function handleTogglePublish(course: ClassroomCourseCard) {
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

  function handleToggleFeatured(course: ClassroomCourseCard) {
    startTransition(async () => {
      try {
        await toggleClassroomCourseFeatured(course.id, !course.isFeatured);
        router.refresh();
      } catch {
        toast.error("No se pudo actualizar el curso.");
      }
    });
  }

  function handleDelete() {
    if (!confirmDeleteId) return;
    startTransition(async () => {
      try {
        await deleteClassroomCourse(confirmDeleteId);
        toast.success("Curso eliminado.");
        setConfirmDeleteId(null);
        router.refresh();
      } catch {
        toast.error("No se pudo eliminar el curso.");
        setConfirmDeleteId(null);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-primary-600 text-white">
            <GraduationCap className="size-5" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">Administrar Classroom</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setShowCategories(true)}>
            <Settings size={16} aria-hidden="true" />
            Categorías
          </Button>
          <Button onClick={() => setShowNewCourse(true)} disabled={!categories.length}>
            <Plus size={16} aria-hidden="true" />
            Nuevo curso
          </Button>
        </div>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Todavía no hay cursos"
          description={categories.length ? "Creá tu primer curso para empezar a armar el Classroom." : "Primero creá al menos una categoría."}
          action={
            categories.length ? (
              <Button onClick={() => setShowNewCourse(true)}>Nuevo curso</Button>
            ) : (
              <Button variant="secondary" onClick={() => setShowCategories(true)}>
                Nueva categoría
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {courses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              href={`/classroom/admin/cursos/${course.id}`}
              showStatus
              adminActions={[
                { label: "Editar contenido", onSelect: () => router.push(`/classroom/admin/cursos/${course.id}`) },
                {
                  label: course.status === "published" ? "Pasar a borrador" : "Publicar",
                  onSelect: () => handleTogglePublish(course),
                },
                {
                  label: course.isFeatured ? "Quitar de destacados" : "Marcar como destacado",
                  onSelect: () => handleToggleFeatured(course),
                },
                { label: "Eliminar", destructive: true, onSelect: () => setConfirmDeleteId(course.id) },
              ]}
            />
          ))}
        </div>
      )}

      <CategoryManagerSheet
        open={showCategories}
        categories={categories}
        onClose={() => setShowCategories(false)}
        onChanged={refreshCategories}
      />
      <NewCourseSheet open={showNewCourse} categories={categories} onClose={() => setShowNewCourse(false)} />

      <ConfirmDialog
        open={Boolean(confirmDeleteId)}
        title="Eliminar curso"
        description="Se eliminarán todos sus capítulos, lecciones, recursos y comentarios. Esta acción no se puede deshacer."
        isLoading={isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
