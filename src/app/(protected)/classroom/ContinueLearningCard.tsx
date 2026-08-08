import Link from "next/link";
import { Award } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { buttonClassName } from "@/components/ui/Button";
import type { ClassroomCourse } from "@/lib/classroom/courses/queries";
import type { CourseProgress } from "@/lib/classroom/progress/queries";

/** The featured "Continuar aprendiendo" hero at the top of the home — always
 * points at the most recently-watched not-yet-finished course/lesson (see
 * getContinueLearning, src/lib/classroom/progress/queries.ts). Único uso de
 * `Card variant="contrast"` en esta vista (14-design-system.md: máximo una
 * card de contraste oscuro por vista) — la imagen de portada solo se muestra
 * si el curso realmente tiene una subida, nunca se inventa una. */
export function ContinueLearningCard({ course, progress, lessonId }: { course: ClassroomCourse; progress: CourseProgress; lessonId: string }) {
  return (
    <Card variant="contrast" className="relative flex flex-col gap-6 overflow-hidden p-0 sm:min-h-56 sm:flex-row sm:items-center">
      {course.coverImageUrl && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- remote Storage URL, dimensions dynamic */}
          <img src={course.coverImageUrl} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-40 sm:left-1/3 sm:w-2/3" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary-950 via-primary-950/90 to-transparent sm:from-primary-950 sm:via-primary-950/70 sm:to-transparent" />
        </>
      )}

      <div className="relative flex flex-1 flex-col gap-3 p-6 sm:p-8">
        <span className="text-xs font-medium uppercase tracking-wide text-white/60">Continuar aprendiendo</span>
        <h2 className="text-2xl font-semibold text-white">{course.title}</h2>
        {course.description && <p className="max-w-md text-sm text-white/70">{course.description}</p>}

        <div className="mt-1 flex items-center gap-3">
          <div className="w-48">
            <ProgressBar value={progress.progressPct} />
          </div>
          <span className="text-sm text-white/80">
            {progress.progressPct}% — {progress.completedCount} de {progress.totalCount} lecciones
          </span>
        </div>

        <div className="mt-2 flex items-center gap-3">
          <Link href={`/classroom/cursos/${course.slug}/${lessonId}`} className={buttonClassName({ variant: "primary", size: "lg" })}>
            Continuar viendo
          </Link>
          <button
            type="button"
            disabled
            title="Próximamente"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/50 disabled:cursor-not-allowed"
          >
            <Award size={16} aria-hidden="true" />
            Certificado
          </button>
        </div>
      </div>
    </Card>
  );
}
