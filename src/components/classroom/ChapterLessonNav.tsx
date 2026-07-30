"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, CheckCircle2, Circle, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { LearnerChapter } from "@/lib/classroom/curriculum/queries";

/** Learner-facing read-only chapter/lesson tree — used both by the course
 * overview page and the player page's left sidebar. Distinct from the
 * admin's AdminChapterLessonTree (drag-and-drop + edit menus): this one only
 * ever navigates and shows completion state, no mutation affordances at
 * all. */
export function ChapterLessonNav({
  chapters,
  courseSlug,
  activeLessonId,
}: {
  chapters: LearnerChapter[];
  courseSlug: string;
  activeLessonId?: string;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggle(chapterId: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-1">
      {chapters.map((chapter) => {
        const isCollapsed = collapsed.has(chapter.id);
        const completedCount = chapter.lessons.filter((l) => l.isCompleted).length;
        return (
          <div key={chapter.id}>
            <button
              type="button"
              onClick={() => toggle(chapter.id)}
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] font-semibold text-foreground hover:bg-surface-2"
            >
              {isCollapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
              <span className="min-w-0 flex-1 truncate">{chapter.title}</span>
              <span className="text-xs font-normal text-neutral-400">
                {completedCount}/{chapter.lessons.length}
              </span>
            </button>
            {!isCollapsed && (
              <ul className="flex flex-col gap-0.5 pb-1 pl-6">
                {chapter.lessons.map((lesson) => {
                  const active = lesson.id === activeLessonId;
                  return (
                    <li key={lesson.id}>
                      <Link
                        href={`/classroom/cursos/${courseSlug}/${lesson.id}`}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px]",
                          active ? "bg-accent-100 text-accent-700" : "text-foreground hover:bg-surface-2",
                        )}
                      >
                        {active ? (
                          <PlayCircle size={14} className="shrink-0 text-accent-600" aria-hidden="true" />
                        ) : lesson.isCompleted ? (
                          <CheckCircle2 size={14} className="shrink-0 text-success-strong" aria-hidden="true" />
                        ) : (
                          <Circle size={14} className="shrink-0 text-neutral-300" aria-hidden="true" />
                        )}
                        <span className="min-w-0 flex-1 truncate">{lesson.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
