import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { CLASSROOM_COLOR_META } from "@/components/classroom/colorMeta";
import type { ClassroomCategory, CategorySummary } from "@/lib/classroom/categories/queries";

function formatHours(hours: number): string {
  if (hours === 0) return "Sin contenido aún";
  return `${hours} ${hours === 1 ? "hora" : "horas"}`;
}

export function CategoryGrid({ categories, summaries }: { categories: ClassroomCategory[]; summaries: Record<string, CategorySummary> }) {
  if (categories.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-[15px] font-semibold text-foreground">Categorías</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {categories.map((category) => {
          const colorMeta = CLASSROOM_COLOR_META[category.color];
          const summary = summaries[category.id] ?? { courseCount: 0, totalHours: 0 };
          return (
            <Link key={category.id} href={`/classroom/categorias/${category.slug}`}>
              <Card className="flex flex-col items-center gap-2 text-center transition-shadow duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:shadow-[var(--elevation-md)]">
                <span className={cn("flex size-12 items-center justify-center rounded-xl text-2xl", colorMeta.bg)}>{category.icon}</span>
                <span className="text-sm font-medium text-foreground">{category.name}</span>
                <span className="text-xs text-neutral-500">
                  {summary.courseCount} {summary.courseCount === 1 ? "curso" : "cursos"} · {formatHours(summary.totalHours)}
                </span>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
