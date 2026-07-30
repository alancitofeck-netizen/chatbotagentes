import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { buttonClassName } from "@/components/ui/Button";
import type { ClassroomCourse } from "@/lib/classroom/courses/queries";
import type { CourseProgress } from "@/lib/classroom/progress/queries";

/** The featured "Continuar aprendiendo" card at the top of the home — always
 * points at the most recently-watched not-yet-finished course/lesson (see
 * getContinueLearning, src/lib/classroom/progress/queries.ts). */
export function ContinueLearningCard({ course, progress, lessonId }: { course: ClassroomCourse; progress: CourseProgress; lessonId: string }) {
  return (
    <Card variant="contrast" className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium uppercase tracking-wide text-white/60">Continuar aprendiendo</span>
        <h2 className="text-xl font-semibold text-white">{course.title}</h2>
        <div className="flex items-center gap-3">
          <div className="w-48">
            <ProgressBar value={progress.progressPct} />
          </div>
          <span className="text-sm text-white/80">
            {progress.progressPct}% — {progress.completedCount} de {progress.totalCount} lecciones
          </span>
        </div>
      </div>
      <Link href={`/classroom/cursos/${course.slug}/${lessonId}`} className={buttonClassName({ variant: "primary", size: "lg" })}>
        Continuar
      </Link>
    </Card>
  );
}
