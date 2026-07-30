import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ClassroomColor = "neutral" | "accent" | "success" | "warning" | "error" | "info";

export interface ClassroomCategory {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  color: ClassroomColor;
  coverImageUrl: string | null;
  position: number;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ClassroomCategoryRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  cover_image_url: string | null;
  position: number;
  is_visible: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORY_SELECT = "id, slug, name, description, icon, color, cover_image_url, position, is_visible, created_at, updated_at";

function mapCategoryRow(r: ClassroomCategoryRow): ClassroomCategory {
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    icon: r.icon,
    color: r.color as ClassroomColor,
    coverImageUrl: r.cover_image_url,
    position: r.position,
    isVisible: r.is_visible,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Learner-facing list — only visible categories, ordered for display.
 * Admin surfaces pass includeHidden so owner/admin can still manage a
 * category they've temporarily hidden. */
export async function getClassroomCategories(includeHidden = false): Promise<ClassroomCategory[]> {
  const supabase = await createClient();
  let query = supabase.from("classroom_categories").select(CATEGORY_SELECT).order("position", { ascending: true });
  if (!includeHidden) query = query.eq("is_visible", true);
  const { data } = await query;
  return (data ?? []).map((r) => mapCategoryRow(r as ClassroomCategoryRow));
}

export async function getClassroomCategoryBySlug(slug: string): Promise<ClassroomCategory | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("classroom_categories").select(CATEGORY_SELECT).eq("slug", slug).maybeSingle();
  return data ? mapCategoryRow(data as ClassroomCategoryRow) : null;
}

export async function getClassroomCategoryById(categoryId: string): Promise<ClassroomCategory | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("classroom_categories").select(CATEGORY_SELECT).eq("id", categoryId).maybeSingle();
  return data ? mapCategoryRow(data as ClassroomCategoryRow) : null;
}

/** Course/hour counts per category for the home's category grid — one
 * batched query across every category id, never one query per card (same
 * "batch, don't N+1" principle as getGroupStatsBatch). Hours are derived
 * from classroom_lessons.duration_seconds, not stored. */
export interface CategorySummary {
  courseCount: number;
  totalHours: number;
}

export async function getCategorySummaries(categoryIds: string[]): Promise<Map<string, CategorySummary>> {
  const map = new Map<string, CategorySummary>();
  if (!categoryIds.length) return map;
  const supabase = await createClient();

  const { data: courses } = await supabase
    .from("classroom_courses")
    .select("id, category_id")
    .eq("status", "published")
    .in("category_id", categoryIds);

  const courseIdsByCategory = new Map<string, string[]>();
  const allCourseIds: string[] = [];
  for (const c of (courses ?? []) as { id: string; category_id: string }[]) {
    const list = courseIdsByCategory.get(c.category_id) ?? [];
    list.push(c.id);
    courseIdsByCategory.set(c.category_id, list);
    allCourseIds.push(c.id);
  }

  const secondsByCourse = new Map<string, number>();
  if (allCourseIds.length) {
    const { data: lessons } = await supabase.from("classroom_lessons").select("course_id, duration_seconds").in("course_id", allCourseIds);
    for (const l of (lessons ?? []) as { course_id: string; duration_seconds: number | null }[]) {
      secondsByCourse.set(l.course_id, (secondsByCourse.get(l.course_id) ?? 0) + (l.duration_seconds ?? 0));
    }
  }

  for (const categoryId of categoryIds) {
    const courseIds = courseIdsByCategory.get(categoryId) ?? [];
    const totalSeconds = courseIds.reduce((sum, id) => sum + (secondsByCourse.get(id) ?? 0), 0);
    map.set(categoryId, { courseCount: courseIds.length, totalHours: Math.round((totalSeconds / 3600) * 10) / 10 });
  }
  return map;
}
