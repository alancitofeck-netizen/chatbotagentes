"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, Building2, Phone, MessageSquare, ChevronLeft } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import type { ConversationDetail, MessageItem } from "@/lib/inbox/queries";
import { cn } from "@/lib/utils/cn";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "long", year: "numeric" });
}

/** Live-appends new inbound/outbound rows via Realtime (supabase/migrations/0003_inbox.sql
 * adds `messages` to the supabase_realtime publication) — first Realtime usage in the project. */
export function ConversationThread({
  detail,
  loading,
  onOpenInfo,
  onBack,
}: {
  detail: ConversationDetail | null;
  loading: boolean;
  onOpenInfo: () => void;
  onBack: () => void;
}) {
  const [liveMessages, setLiveMessages] = useState<MessageItem[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!detail) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`messages-${detail.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${detail.id}` },
        (payload) => {
          const row = payload.new as {
            id: string;
            direction: string;
            sender_type: string;
            type: string;
            content: { body?: string } | null;
            status: string | null;
            created_at: string;
          };
          setLiveMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [
                  ...prev,
                  {
                    id: row.id,
                    direction: row.direction as "inbound" | "outbound",
                    senderType: row.sender_type,
                    body: row.content?.body ?? `[${row.type}]`,
                    type: row.type,
                    status: row.status,
                    createdAt: row.created_at,
                  },
                ],
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // Deliberately keyed only on the id: `detail` also changes reference after
    // refetchDetail() (note/tag/status edits), which shouldn't tear down and
    // recreate the Realtime channel for the same conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id]);

  const allMessages = detail
    ? [...detail.messages, ...liveMessages.filter((m) => !detail.messages.some((d) => d.id === m.id))]
    : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  if (loading) {
    return (
      <div className="flex h-full flex-1 flex-col gap-3 p-6">
        <Skeleton className="h-10 w-1/3" />
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="h-16 w-1/2 self-end" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <EmptyState
          icon={MessageSquare}
          title="Elegí una conversación"
          description="Seleccioná un contacto de la lista para ver el historial."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-border-default p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver a la lista"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2 hover:text-foreground lg:hidden"
          >
            <ChevronLeft size={18} />
          </button>
          <Avatar name={detail.contact.name} src={detail.contact.avatarUrl} size={40} />
          <div>
            <p className="text-sm font-medium text-foreground">{detail.contact.name}</p>
            <p className="flex items-center gap-1 text-xs text-neutral-500">
              {detail.contact.company && (
                <span className="flex items-center gap-1">
                  <Building2 size={12} /> {detail.contact.company}
                </span>
              )}
              {detail.contact.company && detail.contact.phone && <span>·</span>}
              {detail.contact.phone && (
                <span className="flex items-center gap-1">
                  <Phone size={12} /> {detail.contact.phone}
                </span>
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenInfo}
          className="flex items-center gap-1.5 rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-2 lg:hidden"
        >
          <Menu size={14} /> Detalles
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {allMessages.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin mensajes todavía.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {allMessages.map((m, i) => {
              const outbound = m.direction === "outbound";
              const showDay = i === 0 || formatDay(allMessages[i - 1].createdAt) !== formatDay(m.createdAt);
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="my-3 text-center text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                      {formatDay(m.createdAt)}
                    </div>
                  )}
                  <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[75%] rounded-lg px-3.5 py-2 text-sm",
                        outbound ? "bg-accent-500 text-white" : "bg-surface-2 text-foreground",
                      )}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <p className={cn("mt-1 text-[10px]", outbound ? "text-white/70" : "text-neutral-500")}>
                        {formatTime(m.createdAt)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-border-default bg-surface-2 px-4 py-3 text-center text-xs text-neutral-500">
        WhatsApp todavía no está conectado — este Inbox es de solo lectura hasta integrar YCloud.
      </div>
    </div>
  );
}
