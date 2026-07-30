import type { Metadata } from "next";
import { requireUser, requireActiveWorkspace } from "@/lib/auth/session";
import { canManageClassroom } from "@/lib/classroom/authz";
import { getClassroomCategories, getCategorySummaries } from "@/lib/classroom/categories/queries";
import { getCourseCards, getRecentCourseCards, getCourseById } from "@/lib/classroom/courses/queries";
import { getContinueLearning, getCourseProgress, getCourseProgressBatch } from "@/lib/classroom/progress/queries";
import { ClassroomHomeShell } from "./ClassroomHomeShell";

export const metadata: Metadata = {
  title: "Classroom — Growth Link",
};

export default async function ClassroomHomePage() {
  const user = await requireUser();
  const { role } = await requireActiveWorkspace();

  const [categories, featured, recent, continueLearning] = await Promise.all([
    getClassroomCategories(),
    getCourseCards({ featuredOnly: true, limit: 8 }),
    getRecentCourseCards(6),
    getContinueLearning(user.id),
  ]);

  const [categorySummaries, progressByCourse, continueCourse] = await Promise.all([
    getCategorySummaries(categories.map((c) => c.id)),
    getCourseProgressBatch(
      user.id,
      [...new Set([...featured.map((c) => c.id), ...recent.map((c) => c.id)])],
    ),
    continueLearning ? getCourseById(continueLearning.courseId) : Promise.resolve(null),
  ]);

  const continueProgress = continueCourse ? await getCourseProgress(user.id, continueCourse.id) : null;

  return (
    <ClassroomHomeShell
      canManage={canManageClassroom(role)}
      categories={categories}
      categorySummaries={Object.fromEntries(categorySummaries)}
      featuredCourses={featured}
      recentCourses={recent}
      progressByCourse={Object.fromEntries(progressByCourse)}
      continueLearning={
        continueCourse && continueProgress && continueLearning
          ? { course: continueCourse, progress: continueProgress, lessonId: continueLearning.lessonId }
          : null
      }
    />
  );
}
