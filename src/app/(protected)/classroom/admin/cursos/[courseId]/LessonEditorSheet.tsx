"use client";

import { useEffect, useState, useTransition } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Download, Pencil, Repeat, X, Link2, Check } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { VideoEmbed } from "@/components/classroom/VideoEmbed";
import { detectProvider } from "@/lib/classroom/video";
import { resourceKind, RESOURCE_KIND_ICON } from "@/lib/classroom/resourceKind";
import { formatFileSize } from "@/components/documents/documentIcons";
import type { ClassroomLesson, ClassroomLessonResource } from "@/lib/classroom/curriculum/queries";
import {
  createLesson,
  updateLesson,
  addLessonResource,
  updateLessonResource,
  removeLessonResource,
  reorderLessonResources,
  getLessonResourcesAction,
} from "@/lib/classroom/curriculum/actions";

async function uploadResourceFile(file: File, lessonId: string): Promise<{ url: string; fileType: string | null; fileSizeBytes: number }> {
  const body = new FormData();
  body.append("file", file);
  body.append("lessonId", lessonId);
  const res = await fetch("/api/classroom/resources", { method: "POST", body });
  if (!res.ok) throw new Error();
  return res.json();
}

function ResourceRow({
  resource,
  onEdit,
  onReplace,
  onDelete,
  replacing,
}: {
  resource: ClassroomLessonResource;
  onEdit: () => void;
  onReplace: (file: File) => void;
  onDelete: () => void;
  replacing: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: resource.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const kind = resourceKind(resource.fileType, resource.label);
  const Icon = RESOURCE_KIND_ICON[kind];

  return (
    <li ref={setNodeRef} style={style} className="flex items-start gap-2 rounded-lg border border-border-default bg-surface-1 px-3 py-2.5">
      <button
        {...attributes}
        {...listeners}
        type="button"
        aria-label="Reordenar recurso"
        className="mt-0.5 shrink-0 cursor-grab text-neutral-300 hover:text-neutral-500 active:cursor-grabbing"
      >
        <GripVertical size={14} aria-hidden="true" />
      </button>
      <Icon size={16} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-foreground">{resource.label}</p>
        {resource.description && <p className="truncate text-xs text-neutral-500">{resource.description}</p>}
        {resource.fileSizeBytes != null && kind !== "link" && <p className="text-[11px] text-neutral-400">{formatFileSize(resource.fileSizeBytes)}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {kind !== "link" && (
          <a
            href={resource.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2 hover:text-foreground"
            aria-label="Descargar"
          >
            <Download size={14} aria-hidden="true" />
          </a>
        )}
        <button type="button" onClick={onEdit} className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2 hover:text-foreground" aria-label="Editar">
          <Pencil size={14} aria-hidden="true" />
        </button>
        {kind !== "link" && (
          <label className="flex size-7 cursor-pointer items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2 hover:text-foreground" aria-label="Reemplazar archivo">
            {replacing ? <span className="size-3 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" /> : <Repeat size={14} aria-hidden="true" />}
            <input
              type="file"
              className="hidden"
              disabled={replacing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) onReplace(file);
                e.target.value = "";
              }}
            />
          </label>
        )}
        <button type="button" onClick={onDelete} className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong" aria-label="Eliminar">
          <X size={14} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

/** Create/edit a lesson — título/descripción/video URL (con preview en vivo
 * vía VideoEmbed) + duración, y "Contenido del módulo": los recursos
 * (PDF/imagen/enlace/archivo — el video de arriba sigue siendo su propio
 * campo, no un recurso más) como tarjetas tipadas y reordenables por drag
 * (mismo patrón dnd-kit que AdminChapterLessonTree.tsx). Igual que antes,
 * los recursos solo están disponibles con la lección ya guardada (necesita
 * un id real). */
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
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const [linkLabel, setLinkLabel] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [isPending, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

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
        toast.success(lesson ? "Lección actualizada." : "Lección creada — abrila de nuevo para agregar contenido.");
        onSaved();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar la lección.");
      }
    });
  }

  async function refreshResources() {
    if (lesson) setResources(await getLessonResourcesAction(lesson.id));
  }

  async function handleUploadResource(file: File | null) {
    if (!file || !lesson) return;
    setUploadingResource(true);
    try {
      const { url, fileType, fileSizeBytes } = await uploadResourceFile(file, lesson.id);
      await addLessonResource(lesson.id, courseId, { label: file.name, fileUrl: url, fileType, fileSizeBytes });
      await refreshResources();
    } catch {
      toast.error("No se pudo subir el archivo.");
    } finally {
      setUploadingResource(false);
    }
  }

  function handleAddLink() {
    if (!lesson || !linkLabel.trim() || !linkUrl.trim()) return;
    startTransition(async () => {
      try {
        await addLessonResource(lesson.id, courseId, { label: linkLabel, fileUrl: linkUrl.trim(), fileType: "link", fileSizeBytes: null });
        setLinkLabel("");
        setLinkUrl("");
        setAddingLink(false);
        await refreshResources();
      } catch {
        toast.error("No se pudo agregar el enlace.");
      }
    });
  }

  function startEdit(resource: ClassroomLessonResource) {
    setEditingId(resource.id);
    setEditLabel(resource.label);
    setEditDescription(resource.description ?? "");
  }

  function handleSaveEdit() {
    if (!editingId || !editLabel.trim()) return;
    startTransition(async () => {
      try {
        await updateLessonResource(editingId, courseId, { label: editLabel, description: editDescription });
        setEditingId(null);
        await refreshResources();
      } catch {
        toast.error("No se pudo actualizar el recurso.");
      }
    });
  }

  async function handleReplaceResource(resourceId: string, file: File) {
    if (!lesson) return;
    setReplacingId(resourceId);
    try {
      const { url, fileType, fileSizeBytes } = await uploadResourceFile(file, lesson.id);
      const current = resources.find((r) => r.id === resourceId);
      await updateLessonResource(resourceId, courseId, {
        label: current?.label ?? file.name,
        description: current?.description,
        replacement: { fileUrl: url, fileType, fileSizeBytes },
      });
      await refreshResources();
      toast.success("Archivo reemplazado.");
    } catch {
      toast.error("No se pudo reemplazar el archivo.");
    } finally {
      setReplacingId(null);
    }
  }

  async function handleRemoveResource(resourceId: string) {
    if (!lesson) return;
    try {
      await removeLessonResource(resourceId, courseId);
      await refreshResources();
    } catch {
      toast.error("No se pudo eliminar el recurso.");
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !lesson) return;
    const oldIndex = resources.findIndex((r) => r.id === active.id);
    const newIndex = resources.findIndex((r) => r.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(resources, oldIndex, newIndex);
    setResources(next);
    startTransition(async () => {
      try {
        await reorderLessonResources(lesson.id, courseId, next.map((r) => r.id));
      } catch {
        toast.error("No se pudo reordenar.");
        await refreshResources();
      }
    });
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
          label="URL del video (YouTube, Vimeo, Loom, Bunny, Cloudflare, Mux o un .mp4 directo)"
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
        <div className="flex flex-col gap-2.5 border-t border-border-default p-5">
          <span className="text-sm font-medium text-foreground">Contenido del módulo</span>
          <p className="-mt-1.5 text-xs text-neutral-500">PDFs, imágenes, enlaces y material complementario de esta lección.</p>

          {resources.length === 0 ? (
            <p className="text-xs text-neutral-500">Sin recursos todavía.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={resources.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                <ul className="flex flex-col gap-1.5">
                  {resources.map((r) =>
                    editingId === r.id ? (
                      <li key={r.id} className="flex flex-col gap-2 rounded-lg border border-accent-300 bg-accent-50 p-3">
                        <Input label="Título" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} />
                        <Input label="Descripción (opcional)" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                            Cancelar
                          </Button>
                          <Button type="button" size="sm" onClick={handleSaveEdit} loading={isPending}>
                            <Check size={13} aria-hidden="true" />
                            Guardar
                          </Button>
                        </div>
                      </li>
                    ) : (
                      <ResourceRow
                        key={r.id}
                        resource={r}
                        replacing={replacingId === r.id}
                        onEdit={() => startEdit(r)}
                        onReplace={(file) => handleReplaceResource(r.id, file)}
                        onDelete={() => handleRemoveResource(r.id)}
                      />
                    ),
                  )}
                </ul>
              </SortableContext>
            </DndContext>
          )}

          <label className="flex h-16 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong text-sm text-neutral-500 hover:border-accent-500 hover:text-accent-600">
            {uploadingResource ? "Subiendo…" : "Subir archivo (PDF, imagen, plantilla, checklist, etc.)"}
            <input type="file" className="hidden" disabled={uploadingResource} onChange={(e) => handleUploadResource(e.target.files?.[0] ?? null)} />
          </label>

          {addingLink ? (
            <div className="flex flex-col gap-2 rounded-lg border border-border-default p-3">
              <Input label="Título del enlace" value={linkLabel} onChange={(e) => setLinkLabel(e.target.value)} autoFocus />
              <Input label="URL" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." />
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={() => setAddingLink(false)}>
                  Cancelar
                </Button>
                <Button type="button" size="sm" onClick={handleAddLink} loading={isPending}>
                  Agregar enlace
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAddingLink(true)}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-strong py-2 text-sm text-neutral-500 hover:border-accent-500 hover:text-accent-600"
            >
              <Link2 size={14} aria-hidden="true" />
              Agregar enlace externo
            </button>
          )}
        </div>
      )}
    </Sheet>
  );
}
