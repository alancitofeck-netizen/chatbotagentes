"use client";

import { useEffect } from "react";
import { Download, X } from "lucide-react";
import { VideoPlayer } from "./VideoPlayer";

/** Visor embebido — sin salir de Growth Link, sin librerías nuevas: un PDF
 * se abre en un <iframe> (visor nativo del navegador: páginas/zoom/pantalla
 * completa gratis), una imagen en <img>, y un video reusa el VideoPlayer
 * real de la lección (mismo resume-position/marcar-completada que la vista
 * de lección — no un reproductor "de segunda"). Mismo patrón de overlay que
 * el drawer móvil de CoursePlayerShell.tsx, a pantalla completa en vez de
 * un panel lateral. Usado tanto desde la tab de recursos de una lección
 * como desde ModuleContentList.tsx (portada del curso), que necesita abrir
 * cualquiera de los 3 tipos "inline" sin navegar a la lección. */
export function ResourceViewerModal({
  title,
  fileUrl,
  kind,
  video,
  onClose,
}: {
  title: string;
  /** Para "video", la URL cruda del video (mismo formato que lesson.videoUrl). */
  fileUrl: string;
  kind: "pdf" | "image" | "video";
  /** Solo para kind "video" — mismos datos que ya usa la vista de lección
   * real para que reproducir inline desde la portada tenga el mismo
   * resume-position/estado de completado, no una experiencia aparte. */
  video?: { lessonId: string; courseSlug: string; isCompleted: boolean; resumePositionSeconds: number };
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-surface-1 shadow-[var(--elevation-lg)]">
        <div className="flex items-center justify-between gap-3 border-b border-border-default px-4 py-3">
          <p className="min-w-0 truncate text-[14px] font-semibold text-foreground">{title}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            {kind !== "video" && (
              <a
                href={fileUrl}
                target="_blank"
                rel="noreferrer"
                download
                className="flex items-center gap-1.5 rounded-md border border-border-default px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-2"
              >
                <Download size={14} aria-hidden="true" />
                Descargar
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2 hover:text-foreground"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-surface-2">
          {kind === "pdf" && <iframe src={fileUrl} title={title} className="size-full border-0" />}
          {kind === "image" && (
            <div className="flex size-full items-center justify-center overflow-auto p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote Storage URL, dimensions are dynamic */}
              <img src={fileUrl} alt={title} className="max-h-full max-w-full object-contain" />
            </div>
          )}
          {kind === "video" && video && (
            <div className="flex size-full items-center justify-center p-4">
              <VideoPlayer
                videoUrl={fileUrl}
                lessonId={video.lessonId}
                courseSlug={video.courseSlug}
                isCompleted={video.isCompleted}
                initialResumePositionSeconds={video.resumePositionSeconds}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
