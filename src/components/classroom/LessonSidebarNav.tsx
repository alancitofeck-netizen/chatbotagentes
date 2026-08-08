"use client";

import { useMemo, useState } from "react";
import { Search, PlayCircle, Film } from "lucide-react";
import { getYoutubeThumbnailUrl } from "@/lib/classroom/video";
import { ChapterLessonNav } from "./ChapterLessonNav";
import type { LearnerChapter } from "@/lib/classroom/curriculum/queries";

/** Sidebar único de la vista de lección — buscador (filtro client-side,
 * sin server action nueva) + card de "clase actual" + el mismo
 * ChapterLessonNav que ya usa CourseOverview.tsx, ahora recibiendo la lista
 * ya filtrada. Reemplaza, dentro de CoursePlayerShell.tsx, al par de
 * sidebars (temario a la izquierda + info a la derecha) que había antes. */
export function LessonSidebarNav({
  chapters,
  courseSlug,
  activeLessonId,
}: {
  chapters: LearnerChapter[];
  courseSlug: string;
  activeLessonId: string;
}) {
  const [search, setSearch] = useState("");

  const activeLesson = useMemo(
    () => chapters.flatMap((c) => c.lessons).find((l) => l.id === activeLessonId) ?? null,
    [chapters, activeLessonId],
  );
  const thumbnailUrl = activeLesson?.videoUrl ? getYoutubeThumbnailUrl(activeLesson.videoUrl) : null;

  const filteredChapters = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return chapters;
    return chapters
      .map((c) => ({ ...c, lessons: c.lessons.filter((l) => l.title.toLowerCase().includes(q)) }))
      .filter((c) => c.lessons.length > 0);
  }, [chapters, search]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar contenido"
          className="w-full rounded-md border border-border-default bg-surface-1 py-1.5 pr-2.5 pl-8 text-[13px] text-foreground placeholder:text-neutral-400 outline-none focus:border-accent-500"
        />
      </div>

      {activeLesson && (
        <div className="flex items-center gap-2.5 rounded-lg border border-accent-200 bg-accent-50 p-2">
          <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-md bg-neutral-950">
            {thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote thumbnail, dimensions fixed by container
              <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Film size={16} className="text-white/50" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-foreground">{activeLesson.title}</p>
            <span className="flex items-center gap-1 text-[11px] font-medium text-accent-600">
              <PlayCircle size={11} aria-hidden="true" />
              Tocando ahora
            </span>
          </div>
        </div>
      )}

      {filteredChapters.length === 0 ? (
        <p className="px-2 text-[13px] text-neutral-500">Sin resultados para &ldquo;{search}&rdquo;.</p>
      ) : (
        <ChapterLessonNav chapters={filteredChapters} courseSlug={courseSlug} activeLessonId={activeLessonId} />
      )}
    </div>
  );
}
