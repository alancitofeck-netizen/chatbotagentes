"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireClassroomManager } from "@/lib/classroom/authz";
import { generateUniqueSlug } from "@/lib/classroom/slugify";
import type { ClassroomColor } from "./queries";

function revalidateClassroom() {
  revalidatePath("/classroom");
  revalidatePath("/classroom/admin");
}

export interface ClassroomCategoryInput {
  name: string;
  description: string;
  icon: string;
  color: ClassroomColor;
  coverImageUrl: string | null;
  isVisible: boolean;
}

export async function createClassroomCategory(input: ClassroomCategoryInput): Promise<{ id: string }> {
  await requireClassroomManager();
  const name = input.name.trim();
  if (!name) throw new Error("El nombre es obligatorio.");
  const supabase = await createClient();

  const slug = await generateUniqueSlug(supabase, "classroom_categories", name);
  const { count } = await supabase.from("classroom_categories").select("id", { count: "exact", head: true });
  const { data, error } = await supabase
    .from("classroom_categories")
    .insert({
      slug,
      name,
      description: input.description.trim() || null,
      icon: input.icon || "📚",
      color: input.color,
      cover_image_url: input.coverImageUrl,
      is_visible: input.isVisible,
      position: count ?? 0,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("No se pudo crear la categoría.");
  revalidateClassroom();
  return { id: data.id as string };
}

export async function updateClassroomCategory(categoryId: string, input: ClassroomCategoryInput): Promise<void> {
  await requireClassroomManager();
  const name = input.name.trim();
  if (!name) throw new Error("El nombre es obligatorio.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("classroom_categories")
    .update({
      name,
      description: input.description.trim() || null,
      icon: input.icon || "📚",
      color: input.color,
      cover_image_url: input.coverImageUrl,
      is_visible: input.isVisible,
      updated_at: new Date().toISOString(),
    })
    .eq("id", categoryId);
  if (error) throw new Error("No se pudo actualizar la categoría.");
  revalidateClassroom();
}

/** Delete is blocked at the DB level (category_id references restrict) while
 * courses still reference it — surfaced here as a clear message rather than
 * a raw Postgres error. */
export async function deleteClassroomCategory(categoryId: string): Promise<void> {
  await requireClassroomManager();
  const supabase = await createClient();
  const { count } = await supabase
    .from("classroom_courses")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId);
  if (count) throw new Error("No se puede eliminar: hay cursos en esta categoría. Movelos o eliminalos primero.");
  const { error } = await supabase.from("classroom_categories").delete().eq("id", categoryId);
  if (error) throw new Error("No se pudo eliminar la categoría.");
  revalidateClassroom();
}

/** Same drag-reorder pattern as reorderGroups (src/lib/tasks/groups/actions.ts)
 * — bulk-update `position`, plain array index. */
export async function reorderClassroomCategories(orderedIds: string[]): Promise<void> {
  await requireClassroomManager();
  const supabase = await createClient();
  await Promise.all(orderedIds.map((id, index) => supabase.from("classroom_categories").update({ position: index }).eq("id", id)));
  revalidateClassroom();
}
