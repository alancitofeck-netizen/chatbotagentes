import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface ClassroomLesson {
  id: string;
  chapterId: string;
  courseId: string;
  title: string;
  description: string | null;
  videoUrl: string | null;
  durationSeconds: number | null;
  position: number;
  createdAt: string;
  updatedAt: string;
}

export interface ClassroomChapter {
  id: string;
  courseId: string;
  title: string;
  position: number;
  lessons: ClassroomLesson[];
}

interface LessonRow {
  id: string;
  chapter_id: string;
  course_id: string;
  title: string;
  description: string | null;
  video_url: string | null;
  duration_seconds: number | null;
  position: number;
  created_at: string;
  updated_at: string;
}

interface ChapterRow {
  id: string;
  course_id: string;
  title: string;
  position: number;
}

const LESSON_SELECT = "id, chapter_id, course_id, title, description, video_url, duration_seconds, position, created_at, updated_at";

function mapLessonRow(r: LessonRow): ClassroomLesson {
  return {
    id: r.id,
    chapterId: r.chapter_id,
    courseId: r.course_id,
    title: r.title,
    description: r.description,
    videoUrl: r.video_url,
    durationSeconds: r.duration_seconds,
    position: r.position,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Admin/editor shape — full chapter->lesson tree for a course, no progress
 * joined. One query per table, assembled in memory (2 queries total,
 * never N+1 per chapter). */
export async function getChapterTree(courseId: string): Promise<ClassroomChapter[]> {
  const supabase = await createClient();
  const [{ data: chapters }, { data: lessons }] = await Promise.all([
    supabase.from("classroom_chapters").select("id, course_id, title, position").eq("course_id", courseId).order("position", { ascending: true }),
    supabase.from("classroom_lessons").select(LESSON_SELECT).eq("course_id", courseId).order("position", { ascending: true }),
  ]);

  const lessonsByChapter = new Map<string, ClassroomLesson[]>();
  for (const l of (lessons ?? []) as LessonRow[]) {
    const list = lessonsByChapter.get(l.chapter_id) ?? [];
    list.push(mapLessonRow(l));
    lessonsByChapter.set(l.chapter_id, list);
  }

  return ((chapters ?? []) as ChapterRow[]).map((c) => ({
    id: c.id,
    courseId: c.course_id,
    title: c.title,
    position: c.position,
    lessons: lessonsByChapter.get(c.id) ?? [],
  }));
}

export interface LearnerLesson extends ClassroomLesson {
  isCompleted: boolean;
}

export interface LearnerChapter extends Omit<ClassroomChapter, "lessons"> {
  lessons: LearnerLesson[];
}

/** Same tree as getChapterTree, plus each lesson's completion flag for the
 * given user — used by the learner-facing chapter/lesson nav and the course
 * overview page. */
export async function getLearnerChapterTree(courseId: string, userId: string): Promise<LearnerChapter[]> {
  const supabase = await createClient();
  const [chapters, { data: progress }] = await Promise.all([
    getChapterTree(courseId),
    supabase.from("classroom_lesson_progress").select("lesson_id, is_completed").eq("user_id", userId),
  ]);

  const completedLessonIds = new Set(
    ((progress ?? []) as { lesson_id: string; is_completed: boolean }[]).filter((p) => p.is_completed).map((p) => p.lesson_id),
  );

  return chapters.map((c) => ({
    ...c,
    lessons: c.lessons.map((l) => ({ ...l, isCompleted: completedLessonIds.has(l.id) })),
  }));
}

export async function getLessonById(lessonId: string): Promise<ClassroomLesson | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("classroom_lessons").select(LESSON_SELECT).eq("id", lessonId).maybeSingle();
  return data ? mapLessonRow(data as LessonRow) : null;
}

export interface ClassroomLessonResource {
  id: string;
  lessonId: string;
  label: string;
  fileUrl: string;
  fileType: string | null;
  fileSizeBytes: number | null;
  position: number;
}

export async function getLessonResources(lessonId: string): Promise<ClassroomLessonResource[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("classroom_lesson_resources")
    .select("id, lesson_id, label, file_url, file_type, file_size_bytes, position")
    .eq("lesson_id", lessonId)
    .order("position", { ascending: true });
  return ((data ?? []) as { id: string; lesson_id: string; label: string; file_url: string; file_type: string | null; file_size_bytes: number | null; position: number }[]).map(
    (r) => ({
      id: r.id,
      lessonId: r.lesson_id,
      label: r.label,
      fileUrl: r.file_url,
      fileType: r.file_type,
      fileSizeBytes: r.file_size_bytes,
      position: r.position,
    }),
  );
}

/** First not-completed lesson in course order — the target for a course
 * overview's "Continuar"/"Comenzar" CTA. Null means every lesson is
 * completed (or the course has none yet). */
export async function getNextIncompleteLesson(courseId: string, userId: string): Promise<LearnerLesson | null> {
  const chapters = await getLearnerChapterTree(courseId, userId);
  for (const chapter of chapters) {
    for (const lesson of chapter.lessons) {
      if (!lesson.isCompleted) return lesson;
    }
  }
  return null;
}
