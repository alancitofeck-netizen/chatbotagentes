"use client";

import Link from "next/link";
import { GraduationCap, Settings } from "lucide-react";
import { buttonClassName } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchBar } from "./SearchBar";
import { ContinueLearningCard } from "./ContinueLearningCard";
import { CategoryGrid } from "./CategoryGrid";
import { CourseRow } from "./CourseRow";
import type { ClassroomCategory, CategorySummary } from "@/lib/classroom/categories/queries";
import type { ClassroomCourse, ClassroomCourseCard } from "@/lib/classroom/courses/queries";
import type { CourseProgress } from "@/lib/classroom/progress/queries";

export function ClassroomHomeShell({
  canManage,
  categories,
  categorySummaries,
  featuredCourses,
  recentCourses,
  progressByCourse,
  continueLearning,
}: {
  canManage: boolean;
  categories: ClassroomCategory[];
  categorySummaries: Record<string, CategorySummary>;
  featuredCourses: ClassroomCourseCard[];
  recentCourses: ClassroomCourseCard[];
  progressByCourse: Record<string, CourseProgress>;
  continueLearning: { course: ClassroomCourse; progress: CourseProgress; lessonId: string } | null;
}) {
  return (
    <div className="flex flex-col gap-8 p-6 sm:p-8">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-primary-600 text-white">
              <GraduationCap className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-foreground">Classroom</h1>
              <p className="mt-1 text-sm text-neutral-500">Bienvenido nuevamente. Continúa donde quedaste.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SearchBar />
            {canManage && (
              <Link href="/classroom/admin" className={buttonClassName({ variant: "secondary" })}>
                <Settings size={16} aria-hidden="true" />
                Administrar
              </Link>
            )}
          </div>
        </div>
      </div>

      {categories.length === 0 && featuredCourses.length === 0 && recentCourses.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title="Tu Classroom está esperando contenido"
          description={
            canManage
              ? "Creá tu primera categoría y curso para empezar a armar el Classroom."
              : "Cuando haya nuevos cursos o materiales, van a aparecer acá."
          }
          action={
            canManage ? (
              <Link href="/classroom/admin" className={buttonClassName({ variant: "secondary" })}>
                <Settings size={16} aria-hidden="true" />
                Administrar Classroom
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {continueLearning && (
            <ContinueLearningCard course={continueLearning.course} progress={continueLearning.progress} lessonId={continueLearning.lessonId} />
          )}

          <CategoryGrid categories={categories} summaries={categorySummaries} />

          {featuredCourses.length > 0 && (
            <CourseRow
              title="Recomendados para vos"
              // v1 placeholder for the deferred CRM-behavior recommendation
              // engine — reads the manually-curated is_featured flag instead of
              // real usage-based recommendations (see 0071_classroom_module.sql
              // and the Classroom Fase 1 plan's explicit scope note).
              courses={featuredCourses}
              progressByCourse={progressByCourse}
            />
          )}

          {recentCourses.length > 0 && <CourseRow title="Últimos cursos agregados" courses={recentCourses} progressByCourse={progressByCourse} />}
        </>
      )}
    </div>
  );
}
