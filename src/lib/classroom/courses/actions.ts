"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/auth/session";
import { requireClassroomManager } from "@/lib/classroom/authz";
import { generateUniqueSlug } from "@/lib/classroom/slugify";
import type { ClassroomColor } from "@/lib/classroom/categories/queries";
import { searchClassroomCourses, type ClassroomCourseCard, type CourseLevel } from "./queries";

/** Client-callable wrapper for the home's instant-results search bar — any
 * authenticated user can search (not just owner/admin), so no
 * requireClassroomManager() gate here. */
export async function searchClassroomCoursesAction(query: string): Promise<ClassroomCourseCard[]> {
  return searchClassroomCourses(query);
}

function revalidateClassroom(courseSlug?: string) {
  revalidatePath("/classroom");
  revalidatePath("/classroom/admin");
  if (courseSlug) revalidatePath(`/classroom/cursos/${courseSlug}`);
}

export interface ClassroomCourseInput {
  title: string;
  categoryId: string;
  description: string;
  objectives: string[];
  coverImageUrl: string | null;
  color: ClassroomColor;
  level: CourseLevel;
}

export async function createClassroomCourse(input: ClassroomCourseInput): Promise<{ id: string; slug: string }> {
  await requireClassroomManager();
  const title = input.title.trim();
  if (!title) throw new Error("El título es obligatorio.");
  if (!input.categoryId) throw new Error("Elegí una categoría.");
  const user = await getUser();
  const supabase = await createClient();

  const slug = await generateUniqueSlug(supabase, "classroom_courses", title);
  const { count } = await supabase
    .from("classroom_courses")
    .select("id", { count: "exact", head: true })
    .eq("category_id", input.categoryId);
  const { data, error } = await supabase
    .from("classroom_courses")
    .insert({
      category_id: input.categoryId,
      title,
      slug,
      description: input.description.trim() || null,
      objectives: input.objectives.filter((o) => o.trim()),
      cover_image_url: input.coverImageUrl,
      color: input.color,
      level: input.level,
      created_by: user?.id ?? null,
      position: count ?? 0,
    })
    .select("id, slug")
    .single();
  if (error || !data) throw new Error("No se pudo crear el curso.");
  revalidateClassroom();
  return { id: data.id as string, slug: data.slug as string };
}

export async function updateClassroomCourse(courseId: string, input: ClassroomCourseInput): Promise<void> {
  await requireClassroomManager();
  const title = input.title.trim();
  if (!title) throw new Error("El título es obligatorio.");
  const supabase = await createClient();
  const { data: current } = await supabase.from("classroom_courses").select("slug").eq("id", courseId).maybeSingle();
  const { error } = await supabase
    .from("classroom_courses")
    .update({
      category_id: input.categoryId,
      title,
      description: input.description.trim() || null,
      objectives: input.objectives.filter((o) => o.trim()),
      cover_image_url: input.coverImageUrl,
      color: input.color,
      level: input.level,
      updated_at: new Date().toISOString(),
    })
    .eq("id", courseId);
  if (error) throw new Error("No se pudo actualizar el curso.");
  revalidateClassroom(current?.slug as string | undefined);
}

export async function deleteClassroomCourse(courseId: string): Promise<void> {
  await requireClassroomManager();
  const supabase = await createClient();
  const { error } = await supabase.from("classroom_courses").delete().eq("id", courseId);
  if (error) throw new Error("No se pudo eliminar el curso.");
  revalidateClassroom();
}

export async function setClassroomCourseStatus(courseId: string, status: "draft" | "published"): Promise<void> {
  await requireClassroomManager();
  const supabase = await createClient();
  const { data: current } = await supabase.from("classroom_courses").select("slug").eq("id", courseId).maybeSingle();
  const { error } = await supabase.from("classroom_courses").update({ status }).eq("id", courseId);
  if (error) throw new Error("No se pudo actualizar el estado del curso.");
  revalidateClassroom(current?.slug as string | undefined);
}

export async function toggleClassroomCourseFeatured(courseId: string, isFeatured: boolean): Promise<void> {
  await requireClassroomManager();
  const supabase = await createClient();
  const { error } = await supabase.from("classroom_courses").update({ is_featured: isFeatured }).eq("id", courseId);
  if (error) throw new Error("No se pudo actualizar el curso.");
  revalidateClassroom();
}

/** Same drag-reorder pattern as reorderGroups — bulk-update `position` within
 * one category, plain array index. */
export async function reorderClassroomCourses(categoryId: string, orderedIds: string[]): Promise<void> {
  await requireClassroomManager();
  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, index) => supabase.from("classroom_courses").update({ position: index }).eq("id", id).eq("category_id", categoryId)),
  );
  revalidateClassroom();
}
