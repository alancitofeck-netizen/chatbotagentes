import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ClassroomColor } from "@/lib/classroom/categories/queries";

export type CourseLevel = "beginner" | "intermediate" | "advanced";
export type CourseStatus = "draft" | "published";

export interface ClassroomCourse {
  id: string;
  categoryId: string;
  title: string;
  slug: string;
  description: string | null;
  objectives: string[];
  coverImageUrl: string | null;
  color: ClassroomColor;
  level: CourseLevel;
  status: CourseStatus;
  isFeatured: boolean;
  position: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ClassroomCourseRow {
  id: string;
  category_id: string;
  title: string;
  slug: string;
  description: string | null;
  objectives: string[];
  cover_image_url: string | null;
  color: string;
  level: string;
  status: string;
  is_featured: boolean;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const COURSE_SELECT =
  "id, category_id, title, slug, description, objectives, cover_image_url, color, level, status, is_featured, position, created_by, created_at, updated_at";

function mapCourseRow(r: ClassroomCourseRow): ClassroomCourse {
  return {
    id: r.id,
    categoryId: r.category_id,
    title: r.title,
    slug: r.slug,
    description: r.description,
    objectives: r.objectives ?? [],
    coverImageUrl: r.cover_image_url,
    color: r.color as ClassroomColor,
    level: r.level as CourseLevel,
    status: r.status as CourseStatus,
    isFeatured: r.is_featured,
    position: r.position,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export interface ClassroomCourseCard extends ClassroomCourse {
  categoryName: string;
  categorySlug: string;
  categoryIcon: string;
  categoryColor: ClassroomColor;
  lessonCount: number;
  totalDurationSeconds: number;
}

/** Batches lesson-count/duration for a set of courses in one query — same
 * "batch, don't N+1" principle as getGroupStatsBatch
 * (src/lib/tasks/groups/queries.ts). */
async function getLessonSummaries(courseIds: string[]): Promise<Map<string, { lessonCount: number; totalDurationSeconds: number }>> {
  const map = new Map<string, { lessonCount: number; totalDurationSeconds: number }>();
  if (!courseIds.length) return map;
  const supabase = await createClient();
  const { data } = await supabase.from("classroom_lessons").select("course_id, duration_seconds").in("course_id", courseIds);
  for (const l of (data ?? []) as { course_id: string; duration_seconds: number | null }[]) {
    const entry = map.get(l.course_id) ?? { lessonCount: 0, totalDurationSeconds: 0 };
    entry.lessonCount += 1;
    entry.totalDurationSeconds += l.duration_seconds ?? 0;
    map.set(l.course_id, entry);
  }
  return map;
}

interface CourseWithCategoryRow extends ClassroomCourseRow {
  classroom_categories: { name: string; slug: string; icon: string; color: string } | { name: string; slug: string; icon: string; color: string }[];
}

function extractCategory(row: CourseWithCategoryRow) {
  const cat = Array.isArray(row.classroom_categories) ? row.classroom_categories[0] : row.classroom_categories;
  return cat ?? { name: "", slug: "", icon: "📚", color: "accent" };
}

async function toCourseCards(rows: CourseWithCategoryRow[]): Promise<ClassroomCourseCard[]> {
  const summaries = await getLessonSummaries(rows.map((r) => r.id));
  return rows.map((r) => {
    const category = extractCategory(r);
    const summary = summaries.get(r.id) ?? { lessonCount: 0, totalDurationSeconds: 0 };
    return {
      ...mapCourseRow(r),
      categoryName: category.name,
      categorySlug: category.slug,
      categoryIcon: category.icon,
      categoryColor: category.color as ClassroomColor,
      ...summary,
    };
  });
}

export interface CourseCardFilter {
  categorySlug?: string;
  status?: CourseStatus | "all";
  featuredOnly?: boolean;
  limit?: number;
}

/** Learner-facing course grid — published only unless status:"all" is passed
 * (admin list). Joins the category's own display fields in one query via
 * Supabase's FK embed (classroom_courses.category_id -> classroom_categories). */
export async function getCourseCards(filter: CourseCardFilter = {}): Promise<ClassroomCourseCard[]> {
  const supabase = await createClient();
  let query = supabase
    .from("classroom_courses")
    .select(`${COURSE_SELECT}, classroom_categories!inner(name, slug, icon, color)`)
    .order("position", { ascending: true });

  if (filter.status !== "all") query = query.eq("status", filter.status ?? "published");
  if (filter.categorySlug) query = query.eq("classroom_categories.slug", filter.categorySlug);
  if (filter.featuredOnly) query = query.eq("is_featured", true);
  if (filter.limit) query = query.limit(filter.limit);

  const { data } = await query;
  return toCourseCards((data ?? []) as unknown as CourseWithCategoryRow[]);
}

export async function getCourseBySlug(slug: string): Promise<ClassroomCourse | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("classroom_courses").select(COURSE_SELECT).eq("slug", slug).maybeSingle();
  return data ? mapCourseRow(data as ClassroomCourseRow) : null;
}

export async function getCourseById(courseId: string): Promise<ClassroomCourse | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("classroom_courses").select(COURSE_SELECT).eq("id", courseId).maybeSingle();
  return data ? mapCourseRow(data as ClassroomCourseRow) : null;
}

/** Resolves a course's `created_by` (auth.users id) to a display name via
 * the same global name-lookup RPC comments use (classroom_user_names,
 * 0072_classroom_comment_authors.sql) — workspace_member_names doesn't work
 * here since the author may not belong to the viewer's workspace at all. */
export async function getCourseAuthorName(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("classroom_user_names", { user_ids: [userId] });
  return ((data ?? []) as { user_id: string; full_name: string }[])[0]?.full_name ?? null;
}

/** Home's "Últimos cursos agregados" — real recency, not the drag-ordered
 * `position` getCourseCards uses everywhere else. */
export async function getRecentCourseCards(limit = 6): Promise<ClassroomCourseCard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("classroom_courses")
    .select(`${COURSE_SELECT}, classroom_categories!inner(name, slug, icon, color)`)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);
  return toCourseCards((data ?? []) as unknown as CourseWithCategoryRow[]);
}

/** ILIKE search over title/description — Notion-style instant results, no
 * full-text-search index needed at this catalog's expected scale. */
export async function searchClassroomCourses(query: string): Promise<ClassroomCourseCard[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("classroom_courses")
    .select(`${COURSE_SELECT}, classroom_categories!inner(name, slug, icon, color)`)
    .eq("status", "published")
    .or(`title.ilike.%${trimmed}%,description.ilike.%${trimmed}%`)
    .order("updated_at", { ascending: false });
  return toCourseCards((data ?? []) as unknown as CourseWithCategoryRow[]);
}
