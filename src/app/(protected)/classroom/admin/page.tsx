import type { Metadata } from "next";
import { getClassroomCategories } from "@/lib/classroom/categories/queries";
import { getCourseCards } from "@/lib/classroom/courses/queries";
import { AdminClassroomShell } from "./AdminClassroomShell";

export const metadata: Metadata = {
  title: "Administrar Classroom — Growth Link",
};

export default async function ClassroomAdminPage() {
  const [categories, courses] = await Promise.all([
    getClassroomCategories(true),
    getCourseCards({ status: "all" }),
  ]);

  return <AdminClassroomShell categories={categories} courses={courses} />;
}
