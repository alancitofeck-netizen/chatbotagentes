"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireClassroomManager } from "@/lib/classroom/authz";
import { getChapterTree, getLessonResources, type ClassroomChapter, type ClassroomLessonResource } from "./queries";

/** Client-callable wrapper — AdminChapterLessonTree self-fetches its own
 * tree after every mutation, same self-fetch-after-mutation pattern as
 * ComentariosTab.tsx/CommentThread.tsx. */
export async function getChapterTreeAction(courseId: string): Promise<ClassroomChapter[]> {
  await requireClassroomManager();
  return getChapterTree(courseId);
}

export async function getLessonResourcesAction(lessonId: string): Promise<ClassroomLessonResource[]> {
  await requireClassroomManager();
  return getLessonResources(lessonId);
}

function revalidateCourseEditor(courseId: string) {
  revalidatePath(`/classroom/admin/cursos/${courseId}`);
  revalidatePath("/classroom");
}

export async function createChapter(courseId: string, title: string): Promise<{ id: string }> {
  await requireClassroomManager();
  const trimmed = title.trim();
  if (!trimmed) throw new Error("El título del capítulo es obligatorio.");
  const supabase = await createClient();
  const { count } = await supabase.from("classroom_chapters").select("id", { count: "exact", head: true }).eq("course_id", courseId);
  const { data, error } = await supabase
    .from("classroom_chapters")
    .insert({ course_id: courseId, title: trimmed, position: count ?? 0 })
    .select("id")
    .single();
  if (error || !data) throw new Error("No se pudo crear el capítulo.");
  revalidateCourseEditor(courseId);
  return { id: data.id as string };
}

export async function updateChapter(chapterId: string, courseId: string, title: string): Promise<void> {
  await requireClassroomManager();
  const trimmed = title.trim();
  if (!trimmed) throw new Error("El título del capítulo es obligatorio.");
  const supabase = await createClient();
  const { error } = await supabase.from("classroom_chapters").update({ title: trimmed, updated_at: new Date().toISOString() }).eq("id", chapterId);
  if (error) throw new Error("No se pudo actualizar el capítulo.");
  revalidateCourseEditor(courseId);
}

export async function deleteChapter(chapterId: string, courseId: string): Promise<void> {
  await requireClassroomManager();
  const supabase = await createClient();
  const { error } = await supabase.from("classroom_chapters").delete().eq("id", chapterId);
  if (error) throw new Error("No se pudo eliminar el capítulo.");
  revalidateCourseEditor(courseId);
}

/** Same drag-reorder pattern as reorderGroups — bulk-update `position`. */
export async function reorderChapters(courseId: string, orderedIds: string[]): Promise<void> {
  await requireClassroomManager();
  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, index) => supabase.from("classroom_chapters").update({ position: index }).eq("id", id).eq("course_id", courseId)),
  );
  revalidateCourseEditor(courseId);
}

export interface LessonInput {
  title: string;
  description: string;
  videoUrl: string;
  durationSeconds: number | null;
}

export async function createLesson(chapterId: string, courseId: string, input: LessonInput): Promise<{ id: string }> {
  await requireClassroomManager();
  const title = input.title.trim();
  if (!title) throw new Error("El título de la lección es obligatorio.");
  const supabase = await createClient();
  const { count } = await supabase.from("classroom_lessons").select("id", { count: "exact", head: true }).eq("chapter_id", chapterId);
  const { data, error } = await supabase
    .from("classroom_lessons")
    .insert({
      chapter_id: chapterId,
      course_id: courseId,
      title,
      description: input.description.trim() || null,
      video_url: input.videoUrl.trim() || null,
      duration_seconds: input.durationSeconds,
      position: count ?? 0,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("No se pudo crear la lección.");
  revalidateCourseEditor(courseId);
  return { id: data.id as string };
}

export async function updateLesson(lessonId: string, courseId: string, input: LessonInput): Promise<void> {
  await requireClassroomManager();
  const title = input.title.trim();
  if (!title) throw new Error("El título de la lección es obligatorio.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("classroom_lessons")
    .update({
      title,
      description: input.description.trim() || null,
      video_url: input.videoUrl.trim() || null,
      duration_seconds: input.durationSeconds,
      updated_at: new Date().toISOString(),
    })
    .eq("id", lessonId);
  if (error) throw new Error("No se pudo actualizar la lección.");
  revalidateCourseEditor(courseId);
  revalidatePath(`/classroom/cursos/${courseId}/${lessonId}`);
}

export async function deleteLesson(lessonId: string, courseId: string): Promise<void> {
  await requireClassroomManager();
  const supabase = await createClient();
  const { error } = await supabase.from("classroom_lessons").delete().eq("id", lessonId);
  if (error) throw new Error("No se pudo eliminar la lección.");
  revalidateCourseEditor(courseId);
}

/** Same drag-reorder pattern as reorderGroups — bulk-update `position` within
 * one chapter. */
export async function reorderLessons(chapterId: string, courseId: string, orderedIds: string[]): Promise<void> {
  await requireClassroomManager();
  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, index) => supabase.from("classroom_lessons").update({ position: index }).eq("id", id).eq("chapter_id", chapterId)),
  );
  revalidateCourseEditor(courseId);
}

/** Cross-chapter lesson moves are an explicit action, not drag-across-
 * containers — multi-container dnd-kit is real added complexity with no
 * precedent in this repo, deferred as a later nicety. Appends to the end of
 * the destination chapter. */
export async function moveLessonToChapter(lessonId: string, newChapterId: string, courseId: string): Promise<void> {
  await requireClassroomManager();
  const supabase = await createClient();
  const { count } = await supabase.from("classroom_lessons").select("id", { count: "exact", head: true }).eq("chapter_id", newChapterId);
  const { error } = await supabase
    .from("classroom_lessons")
    .update({ chapter_id: newChapterId, position: count ?? 0 })
    .eq("id", lessonId);
  if (error) throw new Error("No se pudo mover la lección.");
  revalidateCourseEditor(courseId);
}

export interface LessonResourceInput {
  label: string;
  fileUrl: string;
  fileType: string | null;
  fileSizeBytes: number | null;
}

export async function addLessonResource(lessonId: string, courseId: string, input: LessonResourceInput): Promise<{ id: string }> {
  await requireClassroomManager();
  const label = input.label.trim();
  if (!label) throw new Error("El nombre del recurso es obligatorio.");
  const supabase = await createClient();
  const { count } = await supabase.from("classroom_lesson_resources").select("id", { count: "exact", head: true }).eq("lesson_id", lessonId);
  const { data, error } = await supabase
    .from("classroom_lesson_resources")
    .insert({
      lesson_id: lessonId,
      label,
      file_url: input.fileUrl,
      file_type: input.fileType,
      file_size_bytes: input.fileSizeBytes,
      position: count ?? 0,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("No se pudo agregar el recurso.");
  revalidateCourseEditor(courseId);
  return { id: data.id as string };
}

/** Removes both the DB row and the underlying Storage object. Uses the
 * service-role client for the Storage delete directly (no Route Handler
 * needed here, unlike upload — see src/app/api/classroom/resources/route.ts)
 * since this already runs server-side after the requireClassroomManager()
 * check above; Storage's own RLS on this bucket is decorative regardless
 * (0070_task_group_covers_final.sql). */
export async function removeLessonResource(resourceId: string, courseId: string): Promise<void> {
  await requireClassroomManager();
  const supabase = await createClient();
  const { data: resource } = await supabase.from("classroom_lesson_resources").select("file_url").eq("id", resourceId).maybeSingle();
  const { error } = await supabase.from("classroom_lesson_resources").delete().eq("id", resourceId);
  if (error) throw new Error("No se pudo eliminar el recurso.");

  if (resource?.file_url) {
    const marker = "/classroom-resources/";
    const idx = (resource.file_url as string).indexOf(marker);
    if (idx !== -1) {
      const path = (resource.file_url as string).slice(idx + marker.length).split("?")[0];
      await createServiceRoleClient().storage.from("classroom-resources").remove([path]);
    }
  }
  revalidateCourseEditor(courseId);
}
