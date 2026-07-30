"use client";

import { useEffect, useState, useTransition } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type { TaskComment } from "@/lib/tasks/queries";
import { addTaskComment, getTaskCommentsAction } from "@/lib/tasks/actions";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** "Comentarios" tab — reuses public.notes (notable_type='task'), same
 * mechanism as CardDetailSheet's "Notas" tab for opportunities, extended
 * here with author avatar/name for a lighter chat-like feel. */
export function ComentariosTab({ taskId }: { taskId: string }) {
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getTaskCommentsAction(taskId).then((fresh) => {
      setComments(fresh);
      setLoaded(true);
    });
  }, [taskId]);

  function handleAdd() {
    if (!body.trim()) return;
    const text = body.trim();
    setBody("");
    startTransition(async () => {
      await addTaskComment(taskId, text);
      setComments(await getTaskCommentsAction(taskId));
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
          placeholder="Agregar un comentario…"
          className="flex-1 rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />
        <Button size="sm" onClick={handleAdd} loading={isPending}>
          Comentar
        </Button>
      </div>
      {comments.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin comentarios todavía.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-2.5">
              <Avatar name={c.authorName} src={c.authorAvatarUrl} size={30} />
              <div className="min-w-0 flex-1 rounded-md bg-surface-2 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{c.authorName}</span>
                  <span className="text-xs text-neutral-500">{formatDate(c.createdAt)}</span>
                </div>
                <p className="mt-1 text-sm text-foreground">{c.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
