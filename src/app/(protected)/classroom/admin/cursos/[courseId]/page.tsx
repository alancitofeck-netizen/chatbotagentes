import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCourseById } from "@/lib/classroom/courses/queries";
import { getClassroomCategories } from "@/lib/classroom/categories/queries";
import { getChapterTree } from "@/lib/classroom/curriculum/queries";
import { CourseEditorShell } from "./CourseEditorShell";

export const metadata: Metadata = {
  title: "Editar curso — Growth Link",
};

export default async function ClassroomCourseEditorPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const [course, categories, chapters] = await Promise.all([
    getCourseById(courseId),
    getClassroomCategories(true),
    getChapterTree(courseId),
  ]);
  if (!course) notFound();

  return <CourseEditorShell course={course} categories={categories} initialChapters={chapters} />;
}
