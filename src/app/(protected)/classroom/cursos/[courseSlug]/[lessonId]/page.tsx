import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser, requireActiveWorkspace } from "@/lib/auth/session";
import { getCourseBySlug, getCourseAuthorName } from "@/lib/classroom/courses/queries";
import { getClassroomCategoryById } from "@/lib/classroom/categories/queries";
import { getLessonById, getLessonResources, getLearnerChapterTree } from "@/lib/classroom/curriculum/queries";
import { getCourseProgress, getLessonProgress } from "@/lib/classroom/progress/queries";
import { canManageClassroom } from "@/lib/classroom/authz";
import { CoursePlayerShell } from "./CoursePlayerShell";

export async function generateMetadata({ params }: { params: Promise<{ courseSlug: string; lessonId: string }> }): Promise<Metadata> {
  const { courseSlug } = await params;
  const course = await getCourseBySlug(courseSlug);
  return { title: course ? `${course.title} — Classroom — Growth Link` : "Classroom — Growth Link" };
}

export default async function ClassroomLessonPage({ params }: { params: Promise<{ courseSlug: string; lessonId: string }> }) {
  const { courseSlug, lessonId } = await params;
  const user = await requireUser();
  const { role } = await requireActiveWorkspace();

  const course = await getCourseBySlug(courseSlug);
  if (!course) notFound();
  const lesson = await getLessonById(lessonId);
  if (!lesson || lesson.courseId !== course.id) notFound();

  const [category, chapters, courseProgress, lessonProgress, resources, authorName] = await Promise.all([
    getClassroomCategoryById(course.categoryId),
    getLearnerChapterTree(course.id, user.id),
    getCourseProgress(user.id, course.id),
    getLessonProgress(user.id, lessonId),
    getLessonResources(lessonId),
    getCourseAuthorName(course.createdBy),
  ]);

  const flatLessons = chapters.flatMap((c) => c.lessons);
  const currentIndex = flatLessons.findIndex((l) => l.id === lessonId);
  const previousLesson = currentIndex > 0 ? flatLessons[currentIndex - 1] : null;
  const nextLesson = currentIndex >= 0 && currentIndex < flatLessons.length - 1 ? flatLessons[currentIndex + 1] : null;

  return (
    <CoursePlayerShell
      course={course}
      category={category}
      lesson={lesson}
      chapters={chapters}
      courseProgress={courseProgress}
      isCompleted={lessonProgress?.isCompleted ?? false}
      resumePositionSeconds={lessonProgress?.resumePositionSeconds ?? 0}
      resources={resources}
      previousLessonId={previousLesson?.id ?? null}
      nextLessonId={nextLesson?.id ?? null}
      canModerateAny={canManageClassroom(role)}
      authorName={authorName}
    />
  );
}
