"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, ListVideo, Paperclip, Target } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import { VideoPlayer } from "@/components/classroom/VideoPlayer";
import { ChapterLessonNav } from "@/components/classroom/ChapterLessonNav";
import { CommentThread } from "@/components/classroom/CommentThread";
import { COURSE_LEVEL_META } from "@/components/classroom/colorMeta";
import type { ClassroomCategory } from "@/lib/classroom/categories/queries";
import type { ClassroomCourse } from "@/lib/classroom/courses/queries";
import type { ClassroomLesson, ClassroomLessonResource, LearnerChapter } from "@/lib/classroom/curriculum/queries";
import type { CourseProgress } from "@/lib/classroom/progress/queries";

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MB`;
}

/** Skool-style course player: left chapter/lesson nav, center video +
 * metadata + resources + comments, right quick-info/progress sidebar. Every
 * child piece (VideoPlayer, ChapterLessonNav, CommentThread) is already a
 * standalone reusable component — this shell is mostly layout + wiring. */
export function CoursePlayerShell({
  course,
  category,
  lesson,
  chapters,
  courseProgress,
  isCompleted,
  resumePositionSeconds,
  resources,
  previousLessonId,
  nextLessonId,
  canModerateAny,
  authorName,
}: {
  course: ClassroomCourse;
  category: ClassroomCategory | null;
  lesson: ClassroomLesson;
  chapters: LearnerChapter[];
  courseProgress: CourseProgress;
  isCompleted: boolean;
  resumePositionSeconds: number;
  resources: ClassroomLessonResource[];
  previousLessonId: string | null;
  nextLessonId: string | null;
  canModerateAny: boolean;
  authorName: string | null;
}) {
  const levelMeta = COURSE_LEVEL_META[course.level];
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="flex h-full">
      <aside className="hidden w-72 shrink-0 flex-col gap-2 overflow-y-auto border-r border-border-default bg-surface-2/60 p-3 lg:flex">
        <Link href={`/classroom/cursos/${course.slug}`} className="mb-1 flex items-center gap-1.5 px-2 text-sm font-medium text-neutral-500 hover:text-foreground">
          <ArrowLeft size={14} aria-hidden="true" />
          <span className="truncate">{course.title}</span>
        </Link>
        <ChapterLessonNav chapters={chapters} courseSlug={course.slug} activeLessonId={lesson.id} />
      </aside>

      {/* Mobile drawer for the chapter/lesson nav above — same overlay +
         `inert` + transition pattern as MobileNav.tsx (Fase 1) and
         TasksSidebar.tsx (Fase 2). Without this, switching lessons on
         mobile required navigating back to the course page — the nav was
         simply unreachable below `lg`. */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-neutral-950/40 transition-opacity duration-300 ease-[var(--ease-out)] lg:hidden",
          navOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />
      <div
        inert={!navOpen}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col gap-2 overflow-y-auto bg-surface-1 p-3 shadow-[var(--elevation-lg)] lg:hidden",
          "transition-transform duration-300 ease-[var(--ease-out)]",
          navOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Link
          href={`/classroom/cursos/${course.slug}`}
          className="mb-1 flex items-center gap-1.5 px-2 text-sm font-medium text-neutral-500 hover:text-foreground"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          <span className="truncate">{course.title}</span>
        </Link>
        <ChapterLessonNav chapters={chapters} courseSlug={course.slug} activeLessonId={lesson.id} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6 sm:p-8">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          className="flex items-center gap-2 self-start rounded-md border border-border-strong px-3 py-2 text-[13px] font-medium text-foreground hover:bg-surface-2 lg:hidden"
        >
          <ListVideo size={15} aria-hidden="true" />
          Lecciones
        </button>

        <VideoPlayer
          videoUrl={lesson.videoUrl ?? ""}
          lessonId={lesson.id}
          courseSlug={course.slug}
          isCompleted={isCompleted}
          initialResumePositionSeconds={resumePositionSeconds}
        />

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {category && (
              <Badge variant={category.color} dot>
                {category.name}
              </Badge>
            )}
            <Badge variant={levelMeta.badge}>{levelMeta.label}</Badge>
          </div>
          <h1 className="text-xl font-semibold text-foreground">{lesson.title}</h1>
          {lesson.description && <p className="whitespace-pre-wrap text-[15px] text-neutral-600">{lesson.description}</p>}
          {course.objectives.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-lg border border-border-default bg-surface-1 p-3">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Target size={13} className="text-accent-500" aria-hidden="true" />
                Objetivos del curso
              </h3>
              <ul className="flex flex-col gap-1 text-[13px] text-neutral-600">
                {course.objectives.map((o, i) => (
                  <li key={i}>• {o}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Same info as the right sidebar (hidden below `xl`) — inline
           instead of a second drawer, since it's secondary reading, not
           navigation. */}
        <div className="flex flex-col gap-2 rounded-lg border border-border-default bg-surface-1 p-3 xl:hidden">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium text-foreground">Progreso del curso</span>
            <span className="text-neutral-500">{courseProgress.progressPct}%</span>
          </div>
          <ProgressBar value={courseProgress.progressPct} />
          <span className="text-xs text-neutral-500">
            {courseProgress.completedCount} de {courseProgress.totalCount} videos
          </span>
        </div>

        {resources.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-foreground">Archivos adjuntos</h3>
            <ul className="flex flex-col gap-1.5">
              {resources.map((r) => (
                <li key={r.id} className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2">
                  <Paperclip size={13} className="shrink-0 text-neutral-400" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{r.label}</span>
                  {r.fileSizeBytes && <span className="text-xs text-neutral-400">{formatFileSize(r.fileSizeBytes)}</span>}
                  <a
                    href={r.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    download
                    className="flex size-9 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground"
                    aria-label="Descargar"
                  >
                    <Download size={15} aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">Comentarios</h3>
          <CommentThread lessonId={lesson.id} courseSlug={course.slug} canModerateAny={canModerateAny} />
        </div>

        <div className="flex items-center justify-between border-t border-border-default pt-4">
          {previousLessonId ? (
            <Link href={`/classroom/cursos/${course.slug}/${previousLessonId}`} className="inline-flex">
              <Button type="button" variant="secondary">
                <ChevronLeft size={15} aria-hidden="true" />
                Anterior
              </Button>
            </Link>
          ) : (
            <span />
          )}
          {nextLessonId && (
            <Link href={`/classroom/cursos/${course.slug}/${nextLessonId}`} className="inline-flex">
              <Button type="button">
                Siguiente
                <ChevronRight size={15} aria-hidden="true" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      <aside className="hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border-default bg-surface-2/60 p-4 xl:flex">
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">{course.title}</h3>
          <div className="flex flex-col gap-1 text-[13px] text-neutral-500">
            <span>{chapters.flatMap((c) => c.lessons).length} videos</span>
            {authorName && <span>Autor: {authorName}</span>}
            <span>Nivel: {levelMeta.label}</span>
            {category && <span>Categoría: {category.name}</span>}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium text-foreground">Progreso</span>
            <span className="text-neutral-500">{courseProgress.progressPct}%</span>
          </div>
          <ProgressBar value={courseProgress.progressPct} />
          <span className="text-xs text-neutral-500">
            {courseProgress.completedCount} de {courseProgress.totalCount} videos
          </span>
        </div>
      </aside>
    </div>
  );
}
