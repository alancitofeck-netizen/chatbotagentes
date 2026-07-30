import type { ClassroomChapter } from "@/lib/classroom/curriculum/queries";
import { AdminChapterLessonTree } from "./AdminChapterLessonTree";

export function ContentTab({ courseId, initialChapters }: { courseId: string; initialChapters: ClassroomChapter[] }) {
  return <AdminChapterLessonTree courseId={courseId} initialChapters={initialChapters} />;
}
