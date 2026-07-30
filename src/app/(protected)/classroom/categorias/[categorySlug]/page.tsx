import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getClassroomCategoryBySlug } from "@/lib/classroom/categories/queries";
import { getCourseCards } from "@/lib/classroom/courses/queries";
import { getCourseProgressBatch } from "@/lib/classroom/progress/queries";
import { CategoryPageShell } from "./CategoryPageShell";

export async function generateMetadata({ params }: { params: Promise<{ categorySlug: string }> }): Promise<Metadata> {
  const { categorySlug } = await params;
  const category = await getClassroomCategoryBySlug(categorySlug);
  return { title: category ? `${category.name} — Classroom — Growth Link` : "Classroom — Growth Link" };
}

export default async function ClassroomCategoryPage({ params }: { params: Promise<{ categorySlug: string }> }) {
  const { categorySlug } = await params;
  const user = await requireUser();
  const category = await getClassroomCategoryBySlug(categorySlug);
  if (!category) notFound();

  const courses = await getCourseCards({ categorySlug });
  const progressByCourse = await getCourseProgressBatch(user.id, courses.map((c) => c.id));

  return <CategoryPageShell category={category} courses={courses} progressByCourse={Object.fromEntries(progressByCourse)} />;
}
