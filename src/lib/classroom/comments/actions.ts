"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser, requireActiveWorkspace } from "@/lib/auth/session";
import { canManageClassroom } from "@/lib/classroom/authz";
import { getLessonComments, type LessonComment } from "./queries";

/** Client-callable wrapper — CommentThread.tsx self-fetches its own list
 * after every mutation, same pattern as ComentariosTab.tsx
 * (getTaskCommentsAction) rather than relying on prop refresh. */
export async function getLessonCommentsAction(lessonId: string): Promise<LessonComment[]> {
  const user = await requireUser();
  const { role } = await requireActiveWorkspace();
  return getLessonComments(lessonId, user.id, canManageClassroom(role));
}

export async function addComment(lessonId: string, courseSlug: string, body: string): Promise<void> {
  const user = await requireUser();
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Escribí un comentario.");
  const supabase = await createClient();
  const { error } = await supabase.from("classroom_comments").insert({ lesson_id: lessonId, user_id: user.id, body: trimmed });
  if (error) throw new Error("No se pudo publicar el comentario.");
  revalidatePath(`/classroom/cursos/${courseSlug}/${lessonId}`);
}

/** Own comment or owner/admin moderating anyone's — both paths are also
 * re-checked by RLS (classroom_comments_update_own / _moderate,
 * 0071_classroom_module.sql), this is just the friendlier error message. */
export async function deleteComment(commentId: string, courseSlug: string, lessonId: string): Promise<void> {
  const user = await requireUser();
  const { role } = await requireActiveWorkspace();
  const supabase = await createClient();

  if (role !== "owner" && role !== "admin") {
    const { data: comment } = await supabase.from("classroom_comments").select("user_id").eq("id", commentId).maybeSingle();
    if (comment?.user_id !== user.id) throw new Error("No podés eliminar el comentario de otra persona.");
  }
  const { error } = await supabase.from("classroom_comments").delete().eq("id", commentId);
  if (error) throw new Error("No se pudo eliminar el comentario.");
  revalidatePath(`/classroom/cursos/${courseSlug}/${lessonId}`);
}

export async function togglePinComment(commentId: string, courseSlug: string, lessonId: string, isPinned: boolean): Promise<void> {
  const { role } = await requireActiveWorkspace();
  if (role !== "owner" && role !== "admin") throw new Error("Solo Owner/Admin pueden fijar comentarios.");
  const supabase = await createClient();
  const { error } = await supabase.from("classroom_comments").update({ is_pinned: isPinned }).eq("id", commentId);
  if (error) throw new Error("No se pudo fijar el comentario.");
  revalidatePath(`/classroom/cursos/${courseSlug}/${lessonId}`);
}

export async function toggleCommentLike(commentId: string, courseSlug: string, lessonId: string, liked: boolean): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  if (liked) {
    await supabase.from("classroom_comment_likes").insert({ comment_id: commentId, user_id: user.id });
  } else {
    await supabase.from("classroom_comment_likes").delete().eq("comment_id", commentId).eq("user_id", user.id);
  }
  revalidatePath(`/classroom/cursos/${courseSlug}/${lessonId}`);
}
