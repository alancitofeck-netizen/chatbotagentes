"use client";

import { useEffect, useState, useTransition } from "react";
import { Heart, Pin, MoreVertical, Send } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { toast } from "@/components/toast/toast";
import { cn } from "@/lib/utils/cn";
import type { LessonComment } from "@/lib/classroom/comments/queries";
import { addComment, deleteComment, togglePinComment, toggleCommentLike, getLessonCommentsAction } from "@/lib/classroom/comments/actions";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Likes+pinning comment thread for a lesson — no existing precedent in this
 * app (ComentariosTab.tsx, tasks module, is a flat list with neither). Same
 * self-fetch-after-mutation pattern as ComentariosTab. */
export function CommentThread({
  lessonId,
  courseSlug,
  canModerateAny,
}: {
  lessonId: string;
  courseSlug: string;
  canModerateAny: boolean;
}) {
  const [comments, setComments] = useState<LessonComment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function refetch() {
    return getLessonCommentsAction(lessonId).then(setComments);
  }

  useEffect(() => {
    refetch().finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  function handleAdd() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setBody("");
    startTransition(async () => {
      try {
        await addComment(lessonId, courseSlug, trimmed);
        await refetch();
      } catch {
        toast.error("No se pudo publicar el comentario.");
      }
    });
  }

  function handleDelete(commentId: string) {
    startTransition(async () => {
      try {
        await deleteComment(commentId, courseSlug, lessonId);
        await refetch();
      } catch {
        toast.error("No se pudo eliminar el comentario.");
      }
    });
  }

  function handleTogglePin(commentId: string, next: boolean) {
    startTransition(async () => {
      try {
        await togglePinComment(commentId, courseSlug, lessonId, next);
        await refetch();
      } catch {
        toast.error("No se pudo fijar el comentario.");
      }
    });
  }

  function handleToggleLike(comment: LessonComment) {
    setComments((prev) =>
      prev.map((c) => (c.id === comment.id ? { ...c, likedByMe: !c.likedByMe, likeCount: c.likeCount + (c.likedByMe ? -1 : 1) } : c)),
    );
    startTransition(async () => {
      try {
        await toggleCommentLike(comment.id, courseSlug, lessonId, !comment.likedByMe);
      } catch {
        toast.error("No se pudo dar me gusta.");
        await refetch();
      }
    });
  }

  if (!loaded) return <Skeleton className="h-24 w-full" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Escribí un comentario…"
          className="flex-1 rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />
        <Button size="sm" onClick={handleAdd} loading={isPending}>
          <Send size={14} aria-hidden="true" />
          Comentar
        </Button>
      </div>

      {comments.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin comentarios todavía — sé el primero en comentar.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <Avatar name={c.authorName} src={c.authorAvatarUrl} size={30} />
              <div className={cn("min-w-0 flex-1 rounded-md p-3", c.isPinned ? "bg-accent-100/50" : "bg-surface-2")}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{c.authorName}</span>
                  <span className="text-xs text-neutral-500">{formatDate(c.createdAt)}</span>
                  {c.isPinned && (
                    <span className="flex items-center gap-1 text-xs font-medium text-accent-700">
                      <Pin size={11} aria-hidden="true" />
                      Fijado
                    </span>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{c.body}</p>
                <div className="mt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleLike(c)}
                    className={cn(
                      "flex items-center gap-1 text-xs font-medium",
                      c.likedByMe ? "text-error-strong" : "text-neutral-500 hover:text-foreground",
                    )}
                  >
                    <Heart size={13} aria-hidden="true" fill={c.likedByMe ? "currentColor" : "none"} />
                    {c.likeCount > 0 ? c.likeCount : "Me gusta"}
                  </button>
                  {(c.canModerate || canModerateAny) && (
                    <DropdownMenu
                      trigger={<MoreVertical size={14} aria-hidden="true" />}
                      triggerLabel="Más acciones"
                      triggerClassName="flex size-6 items-center justify-center rounded text-neutral-400 hover:bg-surface-3 hover:text-foreground"
                      items={[
                        ...(canModerateAny
                          ? [{ label: c.isPinned ? "Quitar fijado" : "Fijar comentario", onSelect: () => handleTogglePin(c.id, !c.isPinned) }]
                          : []),
                        { label: "Eliminar", destructive: true, onSelect: () => handleDelete(c.id) },
                      ]}
                    />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
