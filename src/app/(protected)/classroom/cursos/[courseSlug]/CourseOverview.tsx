import Link from "next/link";
import { ArrowLeft, Target } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { buttonClassName } from "@/components/ui/Button";
import { ChapterLessonNav } from "@/components/classroom/ChapterLessonNav";
import { CLASSROOM_COLOR_META, COURSE_LEVEL_META } from "@/components/classroom/colorMeta";
import { cn } from "@/lib/utils/cn";
import type { ClassroomCategory } from "@/lib/classroom/categories/queries";
import type { ClassroomCourse } from "@/lib/classroom/courses/queries";
import type { LearnerChapter } from "@/lib/classroom/curriculum/queries";
import type { CourseProgress } from "@/lib/classroom/progress/queries";

/** Course landing page — cover/title/description/objectives + progress +
 * "Continuar"/"Comenzar" CTA (targets the first not-yet-completed lesson in
 * course order, or the very first lesson if nothing's been started yet) +
 * the full chapter/lesson nav (same ChapterLessonNav the player page's left
 * sidebar uses, just without an active lesson highlighted here). */
export function CourseOverview({
  course,
  category,
  chapters,
  progress,
}: {
  course: ClassroomCourse;
  category: ClassroomCategory | null;
  chapters: LearnerChapter[];
  progress: CourseProgress;
}) {
  const allLessons = chapters.flatMap((c) => c.lessons);
  const firstIncomplete = allLessons.find((l) => !l.isCompleted);
  const ctaLesson = firstIncomplete ?? allLessons[0];
  const colorMeta = CLASSROOM_COLOR_META[course.color];
  const levelMeta = COURSE_LEVEL_META[course.level];

  return (
    <div className="flex flex-col gap-6 p-6 sm:p-8">
      <Link href={category ? `/classroom/categorias/${category.slug}` : "/classroom"} className="inline-flex w-fit items-center gap-1.5 text-sm text-neutral-500 hover:text-foreground">
        <ArrowLeft size={14} aria-hidden="true" />
        {category ? category.name : "Classroom"}
      </Link>

      {course.coverImageUrl ? (
        <div className="relative flex h-64 w-full items-end overflow-hidden rounded-xl sm:h-80">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote Storage URL, dimensions dynamic */}
          <img src={course.coverImageUrl} alt={course.title} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/85 via-neutral-950/10 to-transparent" aria-hidden="true" />
          <div className="relative z-10 flex flex-col gap-3 p-6">
            <div className="flex flex-wrap items-center gap-1.5">
              {category && (
                <Badge variant={category.color} dot>
                  {category.name}
                </Badge>
              )}
              <Badge variant={levelMeta.badge}>{levelMeta.label}</Badge>
            </div>
            <h1 className="text-2xl font-semibold text-white sm:text-3xl">{course.title}</h1>
          </div>
        </div>
      ) : (
        <div className={cn("flex h-48 w-full items-center justify-center rounded-xl", colorMeta.bg)}>
          <span className="text-6xl">{category?.icon ?? "📚"}</span>
        </div>
      )}

      {!course.coverImageUrl && (
        <div className="flex flex-wrap items-center gap-1.5">
          {category && (
            <Badge variant={category.color} dot>
              {category.name}
            </Badge>
          )}
          <Badge variant={levelMeta.badge}>{levelMeta.label}</Badge>
        </div>
      )}
      {!course.coverImageUrl && <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{course.title}</h1>}

      {course.description && <p className="max-w-2xl text-[15px] text-neutral-600">{course.description}</p>}

      {course.objectives.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-border-default bg-surface-1 p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <Target size={14} className="text-accent-500" aria-hidden="true" />
            Objetivos
          </h3>
          <ul className="flex flex-col gap-1 text-sm text-neutral-600">
            {course.objectives.map((o, i) => (
              <li key={i}>• {o}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-lg border border-border-default bg-surface-1 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              {progress.completedCount} de {progress.totalCount} lecciones
            </span>
            <span className="text-neutral-500">{progress.progressPct}%</span>
          </div>
          <ProgressBar value={progress.progressPct} />
        </div>
        {ctaLesson && (
          <Link href={`/classroom/cursos/${course.slug}/${ctaLesson.id}`} className={buttonClassName({ variant: "primary", size: "lg" })}>
            {progress.completedCount > 0 ? "Continuar" : "Comenzar"}
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-[15px] font-semibold text-foreground">Contenido del curso</h2>
        <div className="rounded-lg border border-border-default bg-surface-1 p-2">
          <ChapterLessonNav chapters={chapters} courseSlug={course.slug} />
        </div>
      </div>
    </div>
  );
}
