import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface LessonProgress {
  lessonId: string;
  isCompleted: boolean;
  completedAt: string | null;
  resumePositionSeconds: number;
  lastWatchedAt: string;
}

export async function getLessonProgress(userId: string, lessonId: string): Promise<LessonProgress | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("classroom_lesson_progress")
    .select("lesson_id, is_completed, completed_at, resume_position_seconds, last_watched_at")
    .eq("user_id", userId)
    .eq("lesson_id", lessonId)
    .maybeSingle();
  if (!data) return null;
  return {
    lessonId: data.lesson_id as string,
    isCompleted: data.is_completed as boolean,
    completedAt: data.completed_at as string | null,
    resumePositionSeconds: data.resume_position_seconds as number,
    lastWatchedAt: data.last_watched_at as string,
  };
}

export interface CourseProgress {
  completedCount: number;
  totalCount: number;
  progressPct: number;
}

function computeCourseProgress(totalLessons: number, completedLessonIds: Set<string>, lessonIds: string[]): CourseProgress {
  const completedCount = lessonIds.filter((id) => completedLessonIds.has(id)).length;
  return {
    completedCount,
    totalCount: totalLessons,
    progressPct: totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0,
  };
}

/** Derived live from classroom_lesson_progress + classroom_lessons on every
 * request — never a stored/cached counter, same "no second source of truth"
 * principle as getGroupStats (src/lib/tasks/groups/queries.ts). */
export async function getCourseProgress(userId: string, courseId: string): Promise<CourseProgress> {
  const supabase = await createClient();
  const [{ data: lessons }, { data: progress }] = await Promise.all([
    supabase.from("classroom_lessons").select("id").eq("course_id", courseId),
    supabase.from("classroom_lesson_progress").select("lesson_id").eq("user_id", userId).eq("is_completed", true),
  ]);
  const lessonIds = ((lessons ?? []) as { id: string }[]).map((l) => l.id);
  const completedIds = new Set(((progress ?? []) as { lesson_id: string }[]).map((p) => p.lesson_id));
  return computeCourseProgress(lessonIds.length, completedIds, lessonIds);
}

/** Batched per-course progress for card grids — one query across all course
 * ids, never one query per card (same "batch, don't N+1" principle as
 * getGroupStatsBatch). */
export async function getCourseProgressBatch(userId: string, courseIds: string[]): Promise<Map<string, CourseProgress>> {
  const map = new Map<string, CourseProgress>();
  if (!courseIds.length) return map;
  const supabase = await createClient();

  const [{ data: lessons }, { data: progress }] = await Promise.all([
    supabase.from("classroom_lessons").select("id, course_id").in("course_id", courseIds),
    supabase.from("classroom_lesson_progress").select("lesson_id").eq("user_id", userId).eq("is_completed", true),
  ]);

  const lessonIdsByCourse = new Map<string, string[]>();
  for (const l of (lessons ?? []) as { id: string; course_id: string }[]) {
    const list = lessonIdsByCourse.get(l.course_id) ?? [];
    list.push(l.id);
    lessonIdsByCourse.set(l.course_id, list);
  }
  const completedIds = new Set(((progress ?? []) as { lesson_id: string }[]).map((p) => p.lesson_id));

  for (const courseId of courseIds) {
    const lessonIds = lessonIdsByCourse.get(courseId) ?? [];
    map.set(courseId, computeCourseProgress(lessonIds.length, completedIds, lessonIds));
  }
  return map;
}

export interface ContinueLearningItem {
  courseId: string;
  lessonId: string;
  lastWatchedAt: string;
}

/** Most recently watched course that isn't 100% complete — the target for
 * the home's "Continuar aprendiendo" card. Looks at the user's most recent
 * lesson_progress rows (regardless of completion) and returns the first
 * whose course isn't fully done yet. */
export async function getContinueLearning(userId: string): Promise<ContinueLearningItem | null> {
  const supabase = await createClient();
  const { data: recent } = await supabase
    .from("classroom_lesson_progress")
    .select("lesson_id, last_watched_at, classroom_lessons!inner(course_id)")
    .eq("user_id", userId)
    .order("last_watched_at", { ascending: false })
    .limit(20);

  for (const row of (recent ?? []) as unknown as { lesson_id: string; last_watched_at: string; classroom_lessons: { course_id: string } }[]) {
    const courseId = row.classroom_lessons.course_id;
    const progress = await getCourseProgress(userId, courseId);
    if (progress.progressPct < 100) return { courseId, lessonId: row.lesson_id, lastWatchedAt: row.last_watched_at };
  }
  return null;
}
