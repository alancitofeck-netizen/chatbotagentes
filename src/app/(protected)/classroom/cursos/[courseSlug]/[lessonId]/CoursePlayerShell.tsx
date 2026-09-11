"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Eye, ExternalLink, ListVideo, Target, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { cn } from "@/lib/utils/cn";
import { VideoPlayer } from "@/components/classroom/VideoPlayer";
import { LessonSidebarNav } from "@/components/classroom/LessonSidebarNav";
import { CommentThread } from "@/components/classroom/CommentThread";
import { ResourceViewerModal } from "@/components/classroom/ResourceViewerModal";
import { COURSE_LEVEL_META } from "@/components/classroom/colorMeta";
import { resourceKind, RESOURCE_KIND_ICON } from "@/lib/classroom/resourceKind";
import { formatFileSize } from "@/components/documents/documentIcons";
import type { ClassroomCategory } from "@/lib/classroom/categories/queries";
import type { ClassroomCourse } from "@/lib/classroom/courses/queries";
import type { ClassroomLesson, ClassroomLessonResource, LearnerChapter } from "@/lib/classroom/curriculum/queries";
import type { CourseProgress } from "@/lib/classroom/progress/queries";

type Tab = "descripcion" | "comentarios";

/** Una fila de "Material complementario" — misma tarjeta tipada
 * (ícono/tamaño/Ver-Descargar-Abrir enlace) que antes vivía dentro de la
 * tab "Materiales", extraída para reusarla ahora que ese contenido está
 * siempre visible en el flujo principal. */
function MaterialRow({ resource, onView }: { resource: ClassroomLessonResource; onView: () => void }) {
  const kind = resourceKind(resource.fileType, resource.label);
  const Icon = RESOURCE_KIND_ICON[kind];
  const canPreview = kind === "pdf" || kind === "image";
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-1 px-3 py-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-neutral-500">
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">{resource.label}</p>
        {resource.description ? (
          <p className="truncate text-xs text-neutral-500">{resource.description}</p>
        ) : (
          resource.fileSizeBytes != null && kind !== "link" && <p className="text-xs text-neutral-400">{formatFileSize(resource.fileSizeBytes)}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {kind === "link" ? (
          <a
            href={resource.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-border-default px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-2"
          >
            <ExternalLink size={13} aria-hidden="true" />
            Abrir enlace
          </a>
        ) : (
          <>
            {canPreview && (
              <button
                type="button"
                onClick={onView}
                className="flex items-center gap-1.5 rounded-md border border-border-default px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-2"
              >
                <Eye size={13} aria-hidden="true" />
                {kind === "pdf" ? "Ver PDF" : "Ver"}
              </button>
            )}
            <a
              href={resource.fileUrl}
              target="_blank"
              rel="noreferrer"
              download
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2 hover:text-foreground"
              aria-label="Descargar"
            >
              <Download size={15} aria-hidden="true" />
            </a>
          </>
        )}
      </div>
    </li>
  );
}

/** Hotmart-style course player: reproductor grande y protagonista, un único
 * sidebar a la derecha (buscador + clase actual + temario) — antes había dos
 * sidebars (temario a la izquierda, info a la derecha), consolidados acá en
 * uno solo (ver plan de Fase 2). Cada pieza (VideoPlayer, LessonSidebarNav,
 * CommentThread) sigue siendo un componente standalone reusable — este shell
 * es mayormente layout + wiring, igual que antes. */
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
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tab, setTab] = useState<Tab>("descripcion");
  const [viewerResource, setViewerResource] = useState<ClassroomLessonResource | null>(null);

  // Si la lección no tiene video, el lugar protagonista de arriba (donde
  // antes quedaba una caja negra vacía "Sin video para esta lección") lo
  // ocupa su PDF o, si no hay PDF, su primera imagen — nunca los dos casos
  // a la vez, y ese recurso no se repite más abajo en "Material
  // complementario". Con video, nada de esto aplica: se ve igual que
  // siempre.
  const hasVideo = Boolean(lesson.videoUrl?.trim());
  const heroResource = hasVideo
    ? null
    : (resources.find((r) => resourceKind(r.fileType, r.label) === "pdf") ??
      resources.find((r) => resourceKind(r.fileType, r.label) === "image") ??
      null);
  const heroKind = heroResource ? resourceKind(heroResource.fileType, heroResource.label) : null;
  const secondaryResources = resources.filter((r) => r.id !== heroResource?.id);

  return (
    <div className="flex h-full">
      {/* Drawer móvil del sidebar — mismo patrón overlay + `inert` +
         transición que MobileNav.tsx/TasksSidebar.tsx. Sin esto, cambiar de
         lección en mobile requería volver a la página del curso. */}
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
          "fixed inset-y-0 right-0 z-50 flex w-80 flex-col gap-4 overflow-y-auto bg-surface-1 p-4 shadow-[var(--elevation-lg)] lg:hidden",
          "transition-transform duration-300 ease-[var(--ease-out)]",
          navOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <Link href={`/classroom/cursos/${course.slug}`} className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-foreground">
          <ArrowLeft size={14} aria-hidden="true" />
          <span className="truncate">{course.title}</span>
        </Link>
        <LessonSidebarNav chapters={chapters} courseSlug={course.slug} activeLessonId={lesson.id} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href={`/classroom/cursos/${course.slug}`} className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-foreground">
            <ArrowLeft size={14} aria-hidden="true" />
            <span className="truncate">{course.title}</span>
          </Link>
          <div className="flex items-center gap-2">
            {previousLessonId && (
              <Link
                href={`/classroom/cursos/${course.slug}/${previousLessonId}`}
                aria-label="Lección anterior"
                className="flex size-8 items-center justify-center rounded-md border border-border-default text-neutral-500 hover:bg-surface-2 hover:text-foreground"
              >
                <ChevronLeft size={15} aria-hidden="true" />
              </Link>
            )}
            {nextLessonId && (
              <Link
                href={`/classroom/cursos/${course.slug}/${nextLessonId}`}
                aria-label="Siguiente lección"
                className="flex size-8 items-center justify-center rounded-md border border-border-default text-neutral-500 hover:bg-surface-2 hover:text-foreground"
              >
                <ChevronRight size={15} aria-hidden="true" />
              </Link>
            )}
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-border-strong px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-surface-2 lg:hidden"
            >
              <ListVideo size={14} aria-hidden="true" />
              Lecciones
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={sidebarOpen ? "Ocultar temario" : "Mostrar temario"}
              className="hidden size-8 items-center justify-center rounded-md border border-border-default text-neutral-500 hover:bg-surface-2 hover:text-foreground lg:flex"
            >
              {sidebarOpen ? <PanelRightClose size={15} aria-hidden="true" /> : <PanelRightOpen size={15} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {hasVideo ? (
          <VideoPlayer
            videoUrl={lesson.videoUrl ?? ""}
            lessonId={lesson.id}
            courseSlug={course.slug}
            isCompleted={isCompleted}
            initialResumePositionSeconds={resumePositionSeconds}
          />
        ) : heroResource && heroKind ? (
          <div className="flex flex-col gap-2">
            <div className="h-[80vh] min-h-[620px] w-full overflow-hidden rounded-lg border border-border-default bg-surface-2">
              {heroKind === "pdf" ? (
                <iframe src={heroResource.fileUrl} title={heroResource.label} className="size-full border-0" />
              ) : (
                <div className="flex size-full items-center justify-center overflow-auto p-4">
                  {/* eslint-disable-next-line @next/next/no-img-element -- remote Storage URL, dimensions are dynamic */}
                  <img src={heroResource.fileUrl} alt={heroResource.label} className="max-h-full max-w-full object-contain" />
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{heroResource.label}</p>
                {heroResource.description && <p className="truncate text-xs text-neutral-500">{heroResource.description}</p>}
              </div>
              <a
                href={heroResource.fileUrl}
                target="_blank"
                rel="noreferrer"
                download
                className="flex shrink-0 items-center gap-1.5 rounded-md border border-border-default px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-2"
              >
                <Download size={13} aria-hidden="true" />
                Descargar
              </a>
            </div>
          </div>
        ) : (
          <VideoPlayer
            videoUrl=""
            lessonId={lesson.id}
            courseSlug={course.slug}
            isCompleted={isCompleted}
            initialResumePositionSeconds={resumePositionSeconds}
          />
        )}

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {category && (
              <Badge variant={category.color} dot>
                {category.name}
              </Badge>
            )}
            <Badge variant={levelMeta.badge}>{levelMeta.label}</Badge>
          </div>
          <h1 className="text-xl font-semibold text-foreground">{lesson.title}</h1>
        </div>

        {secondaryResources.length > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-foreground">Material complementario</p>
            <ul className="flex flex-col gap-2">
              {secondaryResources.map((r) => (
                <MaterialRow key={r.id} resource={r} onView={() => setViewerResource(r)} />
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2 rounded-lg border border-border-default bg-surface-1 p-3 lg:hidden">
          <div className="flex items-center justify-between text-[13px]">
            <span className="font-medium text-foreground">Progreso del curso</span>
            <span className="text-neutral-500">{courseProgress.progressPct}%</span>
          </div>
          <ProgressBar value={courseProgress.progressPct} />
          <span className="text-xs text-neutral-500">
            {courseProgress.completedCount} de {courseProgress.totalCount} videos
          </span>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <TabsList>
            <TabsTrigger value="descripcion">Descripción</TabsTrigger>
            <TabsTrigger value="comentarios">Comentarios</TabsTrigger>
          </TabsList>

          <TabsContent value="descripcion">
            <div className="flex flex-col gap-3 pt-4">
              {lesson.description ? (
                <p className="whitespace-pre-wrap text-[15px] text-neutral-600">{lesson.description}</p>
              ) : (
                <p className="text-sm text-neutral-500">Esta lección no tiene descripción.</p>
              )}
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
          </TabsContent>

          <TabsContent value="comentarios">
            <div className="pt-4">
              <CommentThread lessonId={lesson.id} courseSlug={course.slug} canModerateAny={canModerateAny} />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {sidebarOpen && (
        <aside className="hidden w-80 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border-default bg-surface-2/60 p-4 lg:flex">
          <LessonSidebarNav chapters={chapters} courseSlug={course.slug} activeLessonId={lesson.id} />

          <div className="mt-auto flex flex-col gap-1.5 border-t border-border-default pt-3">
            <div className="flex items-center justify-between text-[13px]">
              <span className="font-medium text-foreground">Progreso del curso</span>
              <span className="text-neutral-500">{courseProgress.progressPct}%</span>
            </div>
            <ProgressBar value={courseProgress.progressPct} />
            <span className="text-xs text-neutral-500">
              {courseProgress.completedCount} de {courseProgress.totalCount} videos
              {authorName && ` · Autor: ${authorName}`}
            </span>
          </div>
        </aside>
      )}

      {viewerResource && (
        <ResourceViewerModal
          title={viewerResource.label}
          fileUrl={viewerResource.fileUrl}
          kind={resourceKind(viewerResource.fileType, viewerResource.label) === "image" ? "image" : "pdf"}
          onClose={() => setViewerResource(null)}
        />
      )}
    </div>
  );
}
