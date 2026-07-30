import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface LessonComment {
  id: string;
  lessonId: string;
  userId: string;
  authorName: string;
  authorAvatarUrl: string | null;
  body: string;
  isPinned: boolean;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
  canModerate: boolean;
}

/** Batches comment rows + like counts + "likedByMe" + author names in a
 * fixed number of queries (never N+1 per comment) — same "batch, don't N+1"
 * principle as getGroupStatsBatch. `canManage` (owner/admin) is passed in so
 * every comment's `canModerate` reflects the viewer's own permission,
 * checked again server-side by the moderate/pin actions regardless. */
export async function getLessonComments(lessonId: string, currentUserId: string | null, canManage: boolean): Promise<LessonComment[]> {
  const supabase = await createClient();
  const { data: comments } = await supabase
    .from("classroom_comments")
    .select("id, lesson_id, user_id, body, is_pinned, created_at")
    .eq("lesson_id", lessonId)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  const rows = (comments ?? []) as { id: string; lesson_id: string; user_id: string; body: string; is_pinned: boolean; created_at: string }[];
  if (!rows.length) return [];

  const commentIds = rows.map((r) => r.id);
  const userIds = [...new Set(rows.map((r) => r.user_id))];

  const [{ data: likes }, { data: authors }] = await Promise.all([
    supabase.from("classroom_comment_likes").select("comment_id, user_id").in("comment_id", commentIds),
    supabase.rpc("classroom_user_names", { user_ids: userIds }),
  ]);

  const likeCountByComment = new Map<string, number>();
  const likedByMeSet = new Set<string>();
  for (const l of (likes ?? []) as { comment_id: string; user_id: string }[]) {
    likeCountByComment.set(l.comment_id, (likeCountByComment.get(l.comment_id) ?? 0) + 1);
    if (currentUserId && l.user_id === currentUserId) likedByMeSet.add(l.comment_id);
  }
  const authorById = new Map(((authors ?? []) as { user_id: string; full_name: string; avatar_url: string | null }[]).map((a) => [a.user_id, a]));

  return rows.map((r) => ({
    id: r.id,
    lessonId: r.lesson_id,
    userId: r.user_id,
    authorName: authorById.get(r.user_id)?.full_name ?? "Usuario",
    authorAvatarUrl: authorById.get(r.user_id)?.avatar_url ?? null,
    body: r.body,
    isPinned: r.is_pinned,
    likeCount: likeCountByComment.get(r.id) ?? 0,
    likedByMe: likedByMeSet.has(r.id),
    createdAt: r.created_at,
    canModerate: canManage || r.user_id === currentUserId,
  }));
}
