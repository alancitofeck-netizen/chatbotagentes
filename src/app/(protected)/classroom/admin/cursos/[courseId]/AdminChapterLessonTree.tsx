"use client";

import { useState, useTransition } from "react";
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, GripVertical, Plus, Pencil, Trash2, MoreVertical, PlayCircle, FolderInput } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { toast } from "@/components/toast/toast";
import type { ClassroomChapter, ClassroomLesson } from "@/lib/classroom/curriculum/queries";
import {
  createChapter,
  updateChapter,
  deleteChapter,
  reorderChapters,
  deleteLesson,
  reorderLessons,
  moveLessonToChapter,
  getChapterTreeAction,
} from "@/lib/classroom/curriculum/actions";
import { ChapterFormSheet } from "./ChapterFormSheet";
import { LessonEditorSheet } from "./LessonEditorSheet";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const min = Math.round(seconds / 60);
  return `${min} min`;
}

function LessonRow({
  lesson,
  otherChapters,
  onEdit,
  onDelete,
  onMove,
}: {
  lesson: ClassroomLesson;
  otherChapters: ClassroomChapter[];
  onEdit: () => void;
  onDelete: () => void;
  onMove: (chapterId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lesson.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <li ref={setNodeRef} style={style} className="group/lesson flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2">
      <button
        {...attributes}
        {...listeners}
        type="button"
        aria-label="Reordenar lección"
        className="cursor-grab text-neutral-300 hover:text-neutral-500 active:cursor-grabbing"
      >
        <GripVertical size={13} aria-hidden="true" />
      </button>
      <PlayCircle size={14} className="shrink-0 text-neutral-400" aria-hidden="true" />
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 truncate text-left text-[13px] text-foreground hover:underline">
        {lesson.title}
      </button>
      {lesson.durationSeconds ? <span className="text-xs text-neutral-400">{formatDuration(lesson.durationSeconds)}</span> : null}
      <DropdownMenu
        trigger={<MoreVertical size={14} aria-hidden="true" />}
        triggerLabel="Más acciones"
        triggerClassName="flex size-6 items-center justify-center rounded text-neutral-400 opacity-0 group-hover/lesson:opacity-100 hover:bg-surface-3 hover:text-foreground"
        items={[
          { label: "Editar", icon: <Pencil size={13} aria-hidden="true" />, onSelect: onEdit },
          ...otherChapters.map((c) => ({
            label: `Mover a "${c.title}"`,
            icon: <FolderInput size={13} aria-hidden="true" />,
            onSelect: () => onMove(c.id),
          })),
          { label: "Eliminar", destructive: true, icon: <Trash2 size={13} aria-hidden="true" />, onSelect: onDelete },
        ]}
      />
    </li>
  );
}

function ChapterCard({
  chapter,
  allChapters,
  expanded,
  onToggleExpand,
  onEditChapter,
  onDeleteChapter,
  onAddLesson,
  onEditLesson,
  onDeleteLesson,
  onMoveLesson,
  onReorderLessons,
}: {
  chapter: ClassroomChapter;
  allChapters: ClassroomChapter[];
  expanded: boolean;
  onToggleExpand: () => void;
  onEditChapter: () => void;
  onDeleteChapter: () => void;
  onAddLesson: () => void;
  onEditLesson: (lesson: ClassroomLesson) => void;
  onDeleteLesson: (lesson: ClassroomLesson) => void;
  onMoveLesson: (lesson: ClassroomLesson, chapterId: string) => void;
  onReorderLessons: (orderedIds: string[]) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: chapter.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const otherChapters = allChapters.filter((c) => c.id !== chapter.id);

  function handleLessonDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = chapter.lessons.findIndex((l) => l.id === active.id);
    const newIndex = chapter.lessons.findIndex((l) => l.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorderLessons(arrayMove(chapter.lessons, oldIndex, newIndex).map((l) => l.id));
  }

  return (
    <div ref={setNodeRef} style={style} className="rounded-lg border border-border-default bg-surface-1">
      <div className="flex items-center gap-2 p-2.5">
        <button
          {...attributes}
          {...listeners}
          type="button"
          aria-label="Reordenar capítulo"
          className="cursor-grab text-neutral-300 hover:text-neutral-500 active:cursor-grabbing"
        >
          <GripVertical size={15} aria-hidden="true" />
        </button>
        <button type="button" onClick={onToggleExpand} className="flex size-6 items-center justify-center text-neutral-500 hover:text-foreground">
          {expanded ? <ChevronDown size={15} aria-hidden="true" /> : <ChevronRight size={15} aria-hidden="true" />}
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{chapter.title}</span>
        <span className="text-xs text-neutral-400">{chapter.lessons.length} lecciones</span>
        <button
          type="button"
          onClick={onEditChapter}
          className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground"
          aria-label="Editar capítulo"
        >
          <Pencil size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onDeleteChapter}
          className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong"
          aria-label="Eliminar capítulo"
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-1 border-t border-border-default p-2">
          {chapter.lessons.length === 0 ? (
            <p className="px-2 py-2 text-xs text-neutral-400">Sin lecciones todavía.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLessonDragEnd}>
              <SortableContext items={chapter.lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
                <ul className="flex flex-col gap-0.5">
                  {chapter.lessons.map((lesson) => (
                    <LessonRow
                      key={lesson.id}
                      lesson={lesson}
                      otherChapters={otherChapters}
                      onEdit={() => onEditLesson(lesson)}
                      onDelete={() => onDeleteLesson(lesson)}
                      onMove={(chapterId) => onMoveLesson(lesson, chapterId)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          )}
          <button
            type="button"
            onClick={onAddLesson}
            className="mt-1 flex items-center gap-1.5 self-start rounded-md px-2 py-1 text-[13px] font-medium text-neutral-500 hover:bg-surface-2 hover:text-foreground"
          >
            <Plus size={13} aria-hidden="true" />
            Nueva lección
          </button>
        </div>
      )}
    </div>
  );
}

/** dnd-kit tree extended to 2 nesting levels from TasksSidebar.tsx's
 * single-level pattern: chapters sortable in one outer SortableContext,
 * each chapter's own lessons sortable in their own inner SortableContext
 * (nested DndContext per chapter — simpler than one shared cross-container
 * context since cross-chapter drag isn't supported here by design). Moving
 * a lesson between chapters is an explicit "Mover a…" menu action instead,
 * not drag-across-containers — real added complexity with no precedent in
 * this repo, deferred as a later nicety. */
export function AdminChapterLessonTree({ courseId, initialChapters }: { courseId: string; initialChapters: ClassroomChapter[] }) {
  const [chapters, setChapters] = useState(initialChapters);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(initialChapters.map((c) => c.id)));
  const [chapterForm, setChapterForm] = useState<{ mode: "create" } | { mode: "edit"; chapter: ClassroomChapter } | null>(null);
  const [lessonForm, setLessonForm] = useState<
    { mode: "create"; chapterId: string } | { mode: "edit"; lesson: ClassroomLesson } | null
  >(null);
  const [confirmDeleteChapter, setConfirmDeleteChapter] = useState<ClassroomChapter | null>(null);
  const [confirmDeleteLesson, setConfirmDeleteLesson] = useState<ClassroomLesson | null>(null);
  const [isPending, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  function refetch() {
    return getChapterTreeAction(courseId).then(setChapters);
  }

  function toggleExpand(chapterId: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(chapterId)) next.delete(chapterId);
      else next.add(chapterId);
      return next;
    });
  }

  function handleChapterDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setChapters((prev) => {
      const oldIndex = prev.findIndex((c) => c.id === active.id);
      const newIndex = prev.findIndex((c) => c.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      startTransition(async () => {
        try {
          await reorderChapters(courseId, next.map((c) => c.id));
        } catch {
          toast.error("No se pudo reordenar.");
        }
      });
      return next;
    });
  }

  function handleReorderLessons(chapterId: string, orderedIds: string[]) {
    setChapters((prev) => prev.map((c) => (c.id === chapterId ? { ...c, lessons: orderedIds.map((id) => c.lessons.find((l) => l.id === id)!) } : c)));
    startTransition(async () => {
      try {
        await reorderLessons(chapterId, courseId, orderedIds);
      } catch {
        toast.error("No se pudo reordenar.");
        await refetch();
      }
    });
  }

  function handleDeleteChapter() {
    if (!confirmDeleteChapter) return;
    startTransition(async () => {
      try {
        await deleteChapter(confirmDeleteChapter.id, courseId);
        setConfirmDeleteChapter(null);
        await refetch();
      } catch {
        toast.error("No se pudo eliminar el capítulo.");
        setConfirmDeleteChapter(null);
      }
    });
  }

  function handleDeleteLesson() {
    if (!confirmDeleteLesson) return;
    startTransition(async () => {
      try {
        await deleteLesson(confirmDeleteLesson.id, courseId);
        setConfirmDeleteLesson(null);
        await refetch();
      } catch {
        toast.error("No se pudo eliminar la lección.");
        setConfirmDeleteLesson(null);
      }
    });
  }

  function handleMoveLesson(lesson: ClassroomLesson, newChapterId: string) {
    startTransition(async () => {
      try {
        await moveLessonToChapter(lesson.id, newChapterId, courseId);
        setExpanded((prev) => new Set(prev).add(newChapterId));
        await refetch();
      } catch {
        toast.error("No se pudo mover la lección.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {chapters.length === 0 ? (
        <EmptyState icon={FolderInput} title="Sin capítulos todavía" description="Creá el primer capítulo para empezar a armar el curso." />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleChapterDragEnd}>
          <SortableContext items={chapters.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {chapters.map((chapter) => (
                <ChapterCard
                  key={chapter.id}
                  chapter={chapter}
                  allChapters={chapters}
                  expanded={expanded.has(chapter.id)}
                  onToggleExpand={() => toggleExpand(chapter.id)}
                  onEditChapter={() => setChapterForm({ mode: "edit", chapter })}
                  onDeleteChapter={() => setConfirmDeleteChapter(chapter)}
                  onAddLesson={() => setLessonForm({ mode: "create", chapterId: chapter.id })}
                  onEditLesson={(lesson) => setLessonForm({ mode: "edit", lesson })}
                  onDeleteLesson={(lesson) => setConfirmDeleteLesson(lesson)}
                  onMoveLesson={handleMoveLesson}
                  onReorderLessons={(orderedIds) => handleReorderLessons(chapter.id, orderedIds)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Button type="button" variant="secondary" onClick={() => setChapterForm({ mode: "create" })} className="self-start" disabled={isPending}>
        <Plus size={15} aria-hidden="true" />
        Nuevo capítulo
      </Button>

      {chapterForm && (
        <ChapterFormSheet
          chapter={chapterForm.mode === "edit" ? chapterForm.chapter : null}
          onClose={() => setChapterForm(null)}
          onSaved={async () => {
            setChapterForm(null);
            await refetch();
          }}
          createAction={(title: string) => createChapter(courseId, title)}
          updateAction={(chapterId: string, title: string) => updateChapter(chapterId, courseId, title)}
        />
      )}

      {lessonForm && (
        <LessonEditorSheet
          lesson={lessonForm.mode === "edit" ? lessonForm.lesson : null}
          chapterId={lessonForm.mode === "create" ? lessonForm.chapterId : lessonForm.lesson.chapterId}
          courseId={courseId}
          onClose={() => setLessonForm(null)}
          onSaved={async () => {
            setLessonForm(null);
            await refetch();
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(confirmDeleteChapter)}
        title="Eliminar capítulo"
        description="Se eliminarán todas sus lecciones y recursos. Esta acción no se puede deshacer."
        isLoading={isPending}
        onConfirm={handleDeleteChapter}
        onCancel={() => setConfirmDeleteChapter(null)}
      />
      <ConfirmDialog
        open={Boolean(confirmDeleteLesson)}
        title="Eliminar lección"
        description="Esta acción no se puede deshacer."
        isLoading={isPending}
        onConfirm={handleDeleteLesson}
        onCancel={() => setConfirmDeleteLesson(null)}
      />
    </div>
  );
}
