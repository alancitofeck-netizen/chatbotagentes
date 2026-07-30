import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

function baseSlug(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics (á -> a, ñ -> n, ...)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Human-readable slug with a numeric-suffix-on-collision scheme ("mi-curso",
 * "mi-curso-2", ...) — unlike miniApps' apiKey.ts random-hex-suffix scheme,
 * which exists there for cross-workspace global-uniqueness of *public hosted
 * URLs*. A Classroom category/course slug collision is rare and entirely
 * human-facing, so a readable numeric suffix beats a hex tail. */
export async function generateUniqueSlug(
  supabase: SupabaseClient,
  table: "classroom_categories" | "classroom_courses",
  text: string,
  excludeId?: string,
): Promise<string> {
  const base = baseSlug(text) || "sin-titulo";
  let candidate = base;
  let attempt = 1;
  for (;;) {
    let query = supabase.from(table).select("id", { count: "exact", head: true }).eq("slug", candidate);
    if (excludeId) query = query.neq("id", excludeId);
    const { count } = await query;
    if (!count) return candidate;
    attempt += 1;
    candidate = `${base}-${attempt}`;
  }
}
