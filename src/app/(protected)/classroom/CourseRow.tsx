import { CourseCard } from "@/components/classroom/CourseCard";
import type { ClassroomCourseCard } from "@/lib/classroom/courses/queries";
import type { CourseProgress } from "@/lib/classroom/progress/queries";

/** Shared horizontal-grid row for "Recomendados para vos"/"Últimos cursos
 * agregados"/category-page grids — same CourseCard tile everywhere. */
export function CourseRow({
  title,
  courses,
  progressByCourse,
}: {
  title: string;
  courses: ClassroomCourseCard[];
  progressByCourse: Record<string, CourseProgress>;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {courses.map((course) => (
          <CourseCard
            key={course.id}
            course={course}
            href={`/classroom/cursos/${course.slug}`}
            progressPct={progressByCourse[course.id]?.progressPct}
          />
        ))}
      </div>
    </div>
  );
}
