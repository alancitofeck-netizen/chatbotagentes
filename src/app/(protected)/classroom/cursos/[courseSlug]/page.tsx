import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getCourseBySlug } from "@/lib/classroom/courses/queries";
import { getClassroomCategoryById } from "@/lib/classroom/categories/queries";
import { getLearnerChapterTree } from "@/lib/classroom/curriculum/queries";
import { getCourseProgress } from "@/lib/classroom/progress/queries";
import { CourseOverview } from "./CourseOverview";

export async function generateMetadata({ params }: { params: Promise<{ courseSlug: string }> }): Promise<Metadata> {
  const { courseSlug } = await params;
  const course = await getCourseBySlug(courseSlug);
  return { title: course ? `${course.title} — Classroom — Growth Link` : "Classroom — Growth Link" };
}

export default async function ClassroomCoursePage({ params }: { params: Promise<{ courseSlug: string }> }) {
  const { courseSlug } = await params;
  const user = await requireUser();
  const course = await getCourseBySlug(courseSlug);
  if (!course) notFound();

  const [category, chapters, progress] = await Promise.all([
    getClassroomCategoryById(course.categoryId),
    getLearnerChapterTree(course.id, user.id),
    getCourseProgress(user.id, course.id),
  ]);

  return <CourseOverview course={course} category={category} chapters={chapters} progress={progress} />;
}
