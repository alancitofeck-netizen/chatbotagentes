"use client";

import { useEffect, useState, useTransition } from "react";
import { Paperclip, Download, X } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { VideoEmbed } from "@/components/classroom/VideoEmbed";
import { detectProvider } from "@/lib/classroom/video";
import type { ClassroomLesson, ClassroomLessonResource } from "@/lib/classroom/curriculum/queries";
import { createLesson, updateLesson, addLessonResource, removeLessonResource, getLessonResourcesAction } from "@/lib/classroom/curriculum/actions";

/** Create/edit a lesson — title/description/video URL (with a live
 * VideoEmbed preview via detectProvider, so an admin sees immediately
 * whether a pasted URL was recognized) + duration + file resources. Resource
 * upload is only available once the lesson has a real id — a brand-new
 * lesson must be saved once first (closing the sheet), then reopened via
 * "Editar" to attach files. This mirrors GroupFormDialog's "cover needs a
 * real id" constraint, just without the extra round trip inside one Sheet
 * session, since resources are a repeatable list rather than a single cover.
 *
 * The parent conditionally mounts this component (not an always-mounted
 * open-boolean), same as GroupFormDialog/ChapterFormSheet — so every text
 * field's initial value is fresh on open with no prop-syncing effect
 * needed; only the resources fetch is a real effect (external data). */
export function LessonEditorSheet({
  lesson,
  chapterId,
  courseId,
  onClose,
  onSaved,
}: {
  lesson: ClassroomLesson | null;
  chapterId: string;
  courseId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(lesson?.title ?? "");
  const [description, setDescription] = useState(lesson?.description ?? "");
  const [videoUrl, setVideoUrl] = useState(lesson?.videoUrl ?? "");
  const [durationMinutes, setDurationMinutes] = useState(lesson?.durationSeconds ? Math.round(lesson.durationSeconds / 60) : "");
  const [resources, setResources] = useState<ClassroomLessonResource[]>([]);
  const [uploadingResource, setUploadingResource] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (lesson) getLessonResourcesAction(lesson.id).then(setResources);
  }, [lesson]);

  const preview = videoUrl.trim() ? detectProvider(videoUrl) : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    const input = {
      title,
      description,
      videoUrl,
      durationSeconds: durationMinutes ? Math.round(Number(durationMinutes) * 60) : null,
    };
    startTransition(async () => {
      try {
        if (lesson) await updateLesson(lesson.id, courseId, input);
        else await createLesson(chapterId, courseId, input);
        toast.success(lesson ? "Lección actualizada." : "Lección creada — abrila de nuevo para adjuntar archivos.");
        onSaved();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar la lección.");
      }
    });
  }

  async function handleUploadResource(file: File | null) {
    if (!file || !lesson) return;
    setUploadingResource(true);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("lessonId", lesson.id);
      const res = await fetch("/api/classroom/resources", { method: "POST", body });
      if (!res.ok) throw new Error();
      const { url, fileType, fileSizeBytes } = (await res.json()) as { url: string; fileType: string | null; fileSizeBytes: number };
      await addLessonResource(lesson.id, courseId, { label: file.name, fileUrl: url, fileType, fileSizeBytes });
      setResources(await getLessonResourcesAction(lesson.id));
    } catch {
      toast.error("No se pudo subir el archivo.");
    } finally {
      setUploadingResource(false);
    }
  }

  async function handleRemoveResource(resourceId: string) {
    if (!lesson) return;
    try {
      await removeLessonResource(resourceId, courseId);
      setResources(await getLessonResourcesAction(lesson.id));
    } catch {
      toast.error("No se pudo eliminar el recurso.");
    }
  }

  return (
    <Sheet open onClose={onClose} title={lesson ? "Editar lección" : "Nueva lección"} className="max-w-lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="lesson-description">
            Descripción
          </label>
          <textarea
            id="lesson-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="resize-none rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        </div>

        <Input
          label="URL del video (YouTube, Vimeo, Bunny, Cloudflare, Mux o un .mp4 directo)"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://..."
        />
        {preview && preview.provider === "unknown" && preview.originalUrl && (
          <p className="text-xs text-warning">No reconocemos este link todavía — se guardará igual, pero puede que no reproduzca.</p>
        )}
        {videoUrl.trim() && <VideoEmbed url={videoUrl} />}

        <Input
          label="Duración (minutos, opcional)"
          type="number"
          min={0}
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(e.target.value === "" ? "" : Number(e.target.value))}
        />

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            {lesson ? "Guardar cambios" : "Crear lección"}
          </Button>
        </div>
      </form>

      {lesson && (
        <div className="flex flex-col gap-2 border-t border-border-default p-5">
          <span className="text-sm font-medium text-foreground">Archivos adjuntos</span>
          {resources.length === 0 ? (
            <p className="text-xs text-neutral-500">Sin archivos todavía.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {resources.map((r) => (
                <li key={r.id} className="flex items-center gap-2 rounded-md bg-surface-2 px-3 py-2">
                  <Paperclip size={13} className="shrink-0 text-neutral-400" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-foreground">{r.label}</span>
                  <a href={r.fileUrl} target="_blank" rel="noreferrer" className="text-neutral-500 hover:text-foreground" aria-label="Descargar">
                    <Download size={14} aria-hidden="true" />
                  </a>
                  <button type="button" onClick={() => handleRemoveResource(r.id)} className="text-neutral-400 hover:text-error-strong" aria-label="Eliminar">
                    <X size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="mt-1 flex h-16 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong text-sm text-neutral-500 hover:border-accent-500 hover:text-accent-600">
            {uploadingResource ? "Subiendo…" : "Subir archivo (PDF, plantilla, checklist, etc.)"}
            <input type="file" className="hidden" disabled={uploadingResource} onChange={(e) => handleUploadResource(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      )}
    </Sheet>
  );
}
