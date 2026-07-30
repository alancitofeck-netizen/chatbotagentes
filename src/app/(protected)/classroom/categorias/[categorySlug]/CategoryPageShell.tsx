"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpen } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { CourseCard } from "@/components/classroom/CourseCard";
import { CLASSROOM_COLOR_META, COURSE_LEVEL_META } from "@/components/classroom/colorMeta";
import { cn } from "@/lib/utils/cn";
import type { ClassroomCategory } from "@/lib/classroom/categories/queries";
import type { ClassroomCourseCard, CourseLevel } from "@/lib/classroom/courses/queries";
import type { CourseProgress } from "@/lib/classroom/progress/queries";

type StatusFilter = "all" | "not_started" | "in_progress" | "completed";
const STATUS_LABELS: Record<StatusFilter, string> = { all: "Todos", not_started: "No iniciados", in_progress: "En progreso", completed: "Completados" };
const LEVELS: (CourseLevel | "all")[] = ["all", "beginner", "intermediate", "advanced"];

function matchesStatus(status: StatusFilter, progress: CourseProgress | undefined): boolean {
  const pct = progress?.progressPct ?? 0;
  if (status === "all") return true;
  if (status === "not_started") return pct === 0;
  if (status === "in_progress") return pct > 0 && pct < 100;
  return pct === 100;
}

/** Category page — full filterable grid, unlike the home's curated sections.
 * Filters run client-side over the already-fetched course list (small
 * catalog scale, no need for server round trips per filter change).
 * "Más populares"/duración filters from the original request are deferred —
 * this catalog has no view-count tracking yet (see Fase 1 scope notes). */
export function CategoryPageShell({
  category,
  courses,
  progressByCourse,
}: {
  category: ClassroomCategory;
  courses: ClassroomCourseCard[];
  progressByCourse: Record<string, CourseProgress>;
}) {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [level, setLevel] = useState<CourseLevel | "all">("all");

  const filtered = useMemo(
    () => courses.filter((c) => matchesStatus(status, progressByCourse[c.id]) && (level === "all" || c.level === level)),
    [courses, progressByCourse, status, level],
  );

  const colorMeta = CLASSROOM_COLOR_META[category.color];

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-8">
      <div>
        <Link href="/classroom" className="mb-3 inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-foreground">
          <ArrowLeft size={14} aria-hidden="true" />
          Classroom
        </Link>
        <div className="flex items-center gap-3">
          <span className={cn("flex size-12 items-center justify-center rounded-xl text-2xl", colorMeta.bg)}>{category.icon}</span>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{category.name}</h1>
            {category.description && <p className="text-sm text-neutral-500">{category.description}</p>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(STATUS_LABELS) as StatusFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatus(key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[13px] font-medium",
                status === key ? "border-accent-500 bg-accent-100 text-accent-700" : "border-border-default text-neutral-500 hover:bg-surface-2",
              )}
            >
              {STATUS_LABELS[key]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {LEVELS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setLevel(key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[13px] font-medium",
                level === key ? "border-accent-500 bg-accent-100 text-accent-700" : "border-border-default text-neutral-500 hover:bg-surface-2",
              )}
            >
              {key === "all" ? "Todos los niveles" : COURSE_LEVEL_META[key].label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title={courses.length === 0 ? "Sin cursos en esta categoría todavía" : "Sin resultados con estos filtros"}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              href={`/classroom/cursos/${course.slug}`}
              progressPct={progressByCourse[course.id]?.progressPct}
            />
          ))}
        </div>
      )}
    </div>
  );
}
