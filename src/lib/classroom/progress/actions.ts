"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/session";

/** "Marcar como completada" — the only completion mechanism in v1 for every
 * provider, including direct MP4 (no auto-complete-at-95%-watched). Upserts
 * so the first watch of a lesson implicitly creates its progress row —
 * there's no separate "enrollment" step (see 0071_classroom_module.sql). */
export async function markLessonComplete(lessonId: string, courseSlug: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("classroom_lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: lessonId,
      is_completed: true,
      completed_at: new Date().toISOString(),
      last_watched_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" },
  );
  if (error) throw new Error("No se pudo guardar el progreso.");
  revalidatePath(`/classroom/cursos/${courseSlug}`);
  revalidatePath(`/classroom/cursos/${courseSlug}/${lessonId}`);
  revalidatePath("/classroom");
}

export async function markLessonIncomplete(lessonId: string, courseSlug: string): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("classroom_lesson_progress")
    .update({ is_completed: false, completed_at: null })
    .eq("user_id", user.id)
    .eq("lesson_id", lessonId);
  if (error) throw new Error("No se pudo actualizar el progreso.");
  revalidatePath(`/classroom/cursos/${courseSlug}`);
  revalidatePath(`/classroom/cursos/${courseSlug}/${lessonId}`);
  revalidatePath("/classroom");
}

/** Throttled (~10s) from the client, only ever called for direct-MP4 lessons
 * — the 4 iframe providers have no reliable cross-origin timeupdate without
 * their own JS SDK (see src/lib/classroom/video.ts's doc comment). Does NOT
 * revalidate any path — this fires frequently during playback and would
 * otherwise thrash the page. */
export async function saveResumePosition(lessonId: string, positionSeconds: number): Promise<void> {
  const user = await requireUser();
  const supabase = await createClient();
  await supabase.from("classroom_lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: lessonId,
      resume_position_seconds: positionSeconds,
      last_watched_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" },
  );
}
