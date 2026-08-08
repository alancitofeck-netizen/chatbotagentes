import Link from "next/link";
import { ArrowRight, BookOpen, Clock, MoreVertical } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { DropdownMenu, type DropdownMenuItem } from "@/components/ui/DropdownMenu";
import { cn } from "@/lib/utils/cn";
import type { ClassroomCourseCard as ClassroomCourseCardData } from "@/lib/classroom/courses/queries";
import { CLASSROOM_COLOR_META, COURSE_LEVEL_META } from "./colorMeta";

function formatHours(totalSeconds: number): string {
  const hours = totalSeconds / 3600;
  if (hours < 1) return `${Math.round(totalSeconds / 60)} min`;
  return `${Math.round(hours * 10) / 10} h`;
}

/** Reusable course tile — home, category grid, search results, and the admin
 * list (which passes `adminActions` to add the "⋮" edit/publish/delete menu
 * and `showStatus` to surface the draft/published Badge management needs but
 * learners never see). `progressPct` is optional — only learner surfaces
 * that have a real per-user session pass it. */
export function CourseCard({
  course,
  href,
  progressPct,
  adminActions,
  showStatus = false,
}: {
  course: ClassroomCourseCardData;
  href: string;
  progressPct?: number;
  adminActions?: DropdownMenuItem[];
  showStatus?: boolean;
}) {
  const colorMeta = CLASSROOM_COLOR_META[course.color];
  const levelMeta = COURSE_LEVEL_META[course.level];

  return (
    <Card className="group relative flex flex-col gap-3 overflow-hidden p-0 transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:shadow-[var(--elevation-md)]">
      <Link href={href} className="flex flex-col gap-3">
        <div className={cn("relative flex h-36 w-full items-center justify-center overflow-hidden", !course.coverImageUrl && colorMeta.bg)}>
          {course.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote Storage URL, dimensions dynamic
            <img src={course.coverImageUrl} alt={course.title} className="h-full w-full object-cover transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out)] group-hover:scale-105" />
          ) : (
            <span className="text-4xl">{course.categoryIcon}</span>
          )}

          {/* Overlay tipo Hotmart: al pasar el mouse, la imagen se oscurece y
              aparecen la cantidad de lecciones + un botón "Entrar" visual —
              el click sigue siendo el mismo <Link> que ya envuelve toda la
              card, esto no agrega un segundo destino. */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-950/0 opacity-0 transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)] group-hover:bg-neutral-950/55 group-hover:opacity-100">
            <span className="flex items-center gap-1 text-[13px] font-medium text-white">
              <BookOpen size={13} aria-hidden="true" />
              {course.lessonCount} {course.lessonCount === 1 ? "clase" : "clases"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-[13px] font-semibold text-neutral-900">
              Entrar
              <ArrowRight size={13} aria-hidden="true" />
            </span>
          </div>

          {course.isFeatured && (
            <Badge variant="accent" className="absolute left-2 top-2">
              Destacado
            </Badge>
          )}
          {showStatus && (
            <Badge variant={course.status === "published" ? "success" : "neutral"} className="absolute right-2 top-2">
              {course.status === "published" ? "Publicado" : "Borrador"}
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-2 px-4 pb-4">
          <div className="flex items-center gap-1.5">
            <Badge variant={course.categoryColor} dot>
              {course.categoryName}
            </Badge>
            <Badge variant={levelMeta.badge}>{levelMeta.label}</Badge>
          </div>
          <h3 className="line-clamp-2 text-[15px] font-semibold text-foreground">{course.title}</h3>
          {course.description && <p className="line-clamp-2 text-[13px] text-neutral-500">{course.description}</p>}
          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <BookOpen size={12} aria-hidden="true" />
              {course.lessonCount} {course.lessonCount === 1 ? "lección" : "lecciones"}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} aria-hidden="true" />
              {formatHours(course.totalDurationSeconds)}
            </span>
          </div>
          {typeof progressPct === "number" && (
            <div className="flex flex-col gap-1">
              <ProgressBar value={progressPct} />
              <span className="text-xs text-neutral-500">{progressPct}% completado</span>
            </div>
          )}
        </div>
      </Link>

      {adminActions && adminActions.length > 0 && (
        <div className="absolute right-2 top-2 z-10">
          <DropdownMenu
            trigger={<MoreVertical size={16} aria-hidden="true" />}
            triggerLabel="Más acciones"
            triggerClassName="flex size-7 items-center justify-center rounded-full bg-neutral-950/50 text-white hover:bg-neutral-950/70"
            items={adminActions}
          />
        </div>
      )}
    </Card>
  );
}
