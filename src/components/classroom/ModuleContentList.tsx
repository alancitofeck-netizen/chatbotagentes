"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, ChevronRight, Download, Eye, ExternalLink, Film, PlayCircle } from "lucide-react";
import { getYoutubeThumbnailUrl } from "@/lib/classroom/video";
import { resourceKind, RESOURCE_KIND_ICON } from "@/lib/classroom/resourceKind";
import { formatFileSize } from "@/components/documents/documentIcons";
import { ResourceViewerModal } from "./ResourceViewerModal";
import type { ClassroomLessonResource, LearnerChapter, LearnerLesson } from "@/lib/classroom/curriculum/queries";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const min = Math.round(seconds / 60);
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

type Viewer = { kind: "pdf" | "image" | "video"; title: string; fileUrl: string; video?: { lessonId: string; resumePositionSeconds: number; isCompleted: boolean } };

/** Una fila del recurso "extra" dentro de una lección de tipo Material
 * complementario — misma tarjeta tipada (ícono/tamaño/Ver-Descargar-Abrir
 * enlace) ya usada en la tab de recursos de la lección. */
function ExtraResourceRow({ resource, onView }: { resource: ClassroomLessonResource; onView: () => void }) {
  const kind = resourceKind(resource.fileType, resource.label);
  const Icon = RESOURCE_KIND_ICON[kind];
  const canPreview = kind === "pdf" || kind === "image";
  return (
    <li className="flex items-center gap-2.5 rounded-md bg-surface-2 px-3 py-2">
      <Icon size={14} className="shrink-0 text-neutral-400" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{resource.label}</span>
      {kind === "link" ? (
        <a href={resource.fileUrl} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 text-xs font-medium text-accent-600 hover:underline">
          <ExternalLink size={12} aria-hidden="true" />
          Abrir
        </a>
      ) : (
        <>
          {canPreview && (
            <button type="button" onClick={onView} className="flex shrink-0 items-center gap-1 text-xs font-medium text-accent-600 hover:underline">
              <Eye size={12} aria-hidden="true" />
              Ver
            </button>
          )}
          <a
            href={resource.fileUrl}
            target="_blank"
            rel="noreferrer"
            download
            className="flex size-6 shrink-0 items-center justify-center rounded text-neutral-400 hover:bg-surface-3 hover:text-foreground"
            aria-label="Descargar"
          >
            <Download size={13} aria-hidden="true" />
          </a>
        </>
      )}
    </li>
  );
}

function LessonRow({
  lesson,
  courseSlug,
  onView,
}: {
  lesson: LearnerLesson;
  courseSlug: string;
  onView: (viewer: Viewer) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasVideo = Boolean(lesson.videoUrl?.trim());
  const pdfResource = !hasVideo ? lesson.resources.find((r) => resourceKind(r.fileType, r.label) === "pdf") : undefined;
  const otherResources = hasVideo ? [] : lesson.resources.filter((r) => r.id !== pdfResource?.id);
  const thumbnailUrl = hasVideo && lesson.videoUrl ? getYoutubeThumbnailUrl(lesson.videoUrl) : null;

  const rowClass = "flex items-center gap-3 rounded-xl border border-border-default bg-surface-1 p-3";

  if (hasVideo) {
    return (
      <li className={rowClass}>
        <div className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-950">
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote thumbnail, dimensions fixed by container
            <img src={thumbnailUrl} alt="" className="h-full w-full object-cover opacity-70" />
          ) : (
            <Film size={20} className="text-white/50" aria-hidden="true" />
          )}
          <PlayCircle size={22} className="absolute text-white drop-shadow" aria-hidden="true" />
          {lesson.durationSeconds ? (
            <span className="absolute right-1 bottom-1 rounded bg-black/70 px-1 text-[10px] font-medium text-white">{formatDuration(lesson.durationSeconds)}</span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-foreground">
            {lesson.title}
            {lesson.isCompleted && <CheckCircle2 size={13} className="shrink-0 text-success-strong" aria-hidden="true" />}
          </p>
          {lesson.description && <p className="truncate text-xs text-neutral-500">{lesson.description}</p>}
        </div>
        <button
          type="button"
          onClick={() =>
            onView({
              kind: "video",
              title: lesson.title,
              fileUrl: lesson.videoUrl ?? "",
              video: { lessonId: lesson.id, resumePositionSeconds: 0, isCompleted: lesson.isCompleted },
            })
          }
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-accent-500 px-3 py-1.5 text-xs font-medium text-[var(--on-accent)] hover:bg-accent-600"
        >
          <PlayCircle size={14} aria-hidden="true" />
          Ver video
        </button>
      </li>
    );
  }

  if (pdfResource) {
    const kind = resourceKind(pdfResource.fileType, pdfResource.label);
    const Icon = RESOURCE_KIND_ICON[kind];
    return (
      <li className={rowClass}>
        <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-error-bg text-error-strong">
          <Icon size={22} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-foreground">
            {lesson.title}
            {lesson.isCompleted && <CheckCircle2 size={13} className="shrink-0 text-success-strong" aria-hidden="true" />}
          </p>
          {(lesson.description || pdfResource.description) && (
            <p className="truncate text-xs text-neutral-500">{lesson.description ?? pdfResource.description}</p>
          )}
          <p className="truncate text-[11px] text-neutral-400">
            {pdfResource.label}
            {pdfResource.fileSizeBytes != null && ` · ${formatFileSize(pdfResource.fileSizeBytes)}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => onView({ kind: "pdf", title: pdfResource.label, fileUrl: pdfResource.fileUrl })}
            className="flex items-center gap-1.5 rounded-md border border-border-default px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-2"
          >
            <Eye size={13} aria-hidden="true" />
            Ver PDF
          </button>
          <a
            href={pdfResource.fileUrl}
            target="_blank"
            rel="noreferrer"
            download
            className="flex items-center gap-1.5 rounded-md bg-accent-500 px-2.5 py-1.5 text-xs font-medium text-[var(--on-accent)] hover:bg-accent-600"
          >
            <Download size={13} aria-hidden="true" />
            Descargar
          </a>
        </div>
      </li>
    );
  }

  if (otherResources.length > 0) {
    return (
      <li className="flex flex-col gap-2 rounded-xl border border-border-default bg-surface-1 p-3">
        <button type="button" onClick={() => setExpanded((v) => !v)} className="flex w-full items-center gap-3 text-left">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-accent-100 text-accent-700">
            <ExternalLink size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-foreground">
              {lesson.title}
              {lesson.isCompleted && <CheckCircle2 size={13} className="shrink-0 text-success-strong" aria-hidden="true" />}
            </p>
            {lesson.description && <p className="truncate text-xs text-neutral-500">{lesson.description}</p>}
          </div>
          {expanded ? <ChevronDown size={16} className="shrink-0 text-neutral-400" aria-hidden="true" /> : <ChevronRight size={16} className="shrink-0 text-neutral-400" aria-hidden="true" />}
        </button>
        {expanded && (
          <ul className="flex flex-col gap-1.5 pl-[68px]">
            {otherResources.map((r) => (
              <ExtraResourceRow
                key={r.id}
                resource={r}
                onView={() => onView({ kind: resourceKind(r.fileType, r.label) === "image" ? "image" : "pdf", title: r.label, fileUrl: r.fileUrl })}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <li className={rowClass}>
      <span className="flex size-14 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-neutral-400">
        <ExternalLink size={20} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-foreground">
          {lesson.title}
          {lesson.isCompleted && <CheckCircle2 size={13} className="shrink-0 text-success-strong" aria-hidden="true" />}
        </p>
        {lesson.description && <p className="truncate text-xs text-neutral-500">{lesson.description}</p>}
      </div>
      <Link
        href={`/classroom/cursos/${courseSlug}/${lesson.id}`}
        className="flex size-8 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-surface-2 hover:text-foreground"
        aria-label="Abrir lección"
      >
        <ChevronRight size={16} aria-hidden="true" />
      </Link>
    </li>
  );
}

/** "Contenido del módulo" — reemplaza al árbol compacto ChapterLessonNav
 * únicamente en la portada del curso (CourseOverview.tsx; el sidebar de la
 * vista de lección sigue usando ChapterLessonNav tal cual, sin tocar). Cada
 * lección es una fila cuyo tipo (video/PDF/material complementario) se
 * infiere de su contenido real, nunca se guarda — mismo criterio que
 * resourceKind(). Ver video/Ver PDF abren inline en ResourceViewerModal,
 * sin navegar a la lección. */
export function ModuleContentList({ chapters, courseSlug }: { chapters: LearnerChapter[]; courseSlug: string }) {
  const [viewer, setViewer] = useState<Viewer | null>(null);
  const showChapterHeaders = chapters.length > 1;

  return (
    <div className="flex flex-col gap-4">
      {chapters.map((chapter) => (
        <div key={chapter.id} className="flex flex-col gap-2">
          {showChapterHeaders && <p className="text-xs font-semibold text-neutral-500">{chapter.title}</p>}
          <ul className="flex flex-col gap-2">
            {chapter.lessons.map((lesson) => (
              <LessonRow key={lesson.id} lesson={lesson} courseSlug={courseSlug} onView={setViewer} />
            ))}
          </ul>
        </div>
      ))}

      {viewer && (
        <ResourceViewerModal
          title={viewer.title}
          fileUrl={viewer.fileUrl}
          kind={viewer.kind}
          video={viewer.video ? { ...viewer.video, courseSlug } : undefined}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}
