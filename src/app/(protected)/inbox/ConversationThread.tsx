"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, Building2, Phone, MessageSquare, ChevronLeft, Send, RotateCw, AlertTriangle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/toast/toast";
import type { ConversationDetail, MessageItem } from "@/lib/inbox/queries";
import { cn } from "@/lib/utils/cn";

/** Optimistic-only state, never persisted as-is — `localStatus` is distinct
 * from `status` (which holds YCloud's real message status) so a pending/failed
 * send is never confused with a real server-confirmed status value. */
interface PendingMessage extends MessageItem {
  localStatus: "sending" | "error";
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "long", year: "numeric" });
}

const ERROR_MESSAGES: Record<string, string> = {
  contact_unsubscribed: "Este contacto se dio de baja de WhatsApp — no se le puede escribir.",
  contact_missing_phone: "El contacto no tiene un teléfono cargado.",
  conversation_missing_business_number: "Esta conversación no tiene un número de WhatsApp asociado.",
  ycloud_not_configured: "YCloud no está configurado en el servidor (falta YCLOUD_API_KEY).",
  ycloud_send_failed: "YCloud rechazó el envío del mensaje.",
  ycloud_network_error: "No se pudo contactar a YCloud. Revisá tu conexión e intentá de nuevo.",
  content_too_long: "El mensaje es demasiado largo (máximo 4096 caracteres).",
  conversation_not_found: "No se encontró la conversación.",
  unauthorized: "Tu sesión expiró. Volvé a iniciar sesión.",
};

function errorMessageFor(code: string | undefined): string {
  return ERROR_MESSAGES[code ?? ""] ?? "No se pudo enviar el mensaje.";
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
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  // A ref counter (not Date.now()/Math.random()) for temp-id generation —
  // those are impure calls the react-hooks/purity rule flags even inside an
  // event handler defined in the component body.
  const tempIdCounter = useRef(0);

  const [messageOverrides, setMessageOverrides] = useState<Record<string, { status: string | null; errorReason: string | null }>>(
    {},
  );

  useEffect(() => {
    if (!detail) return;
    const supabase = createClient();
    type MessageRow = {
      id: string;
      direction: string;
      sender_type: string;
      type: string;
      content: { body?: string; error?: { message?: string } } | null;
      status: string | null;
      created_at: string;
    };
    const channel = supabase
      .channel(`messages-${detail.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${detail.id}` },
        (payload) => {
          const row = payload.new as MessageRow;
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
                    errorReason: row.content?.error?.message ?? null,
                  },
                ],
          );
        },
      )
      .on(
        // Status transitions for a message THIS app already sent (sent →
        // delivered/read/failed), pushed by processMessageStatusUpdate in
        // src/app/api/webhooks/ycloud/route.ts. Stored as an overlay (not
        // merged into liveMessages) since the row being updated usually
        // already lives in `detail.messages` (fetched on open), not here.
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${detail.id}` },
        (payload) => {
          const row = payload.new as MessageRow;
          setMessageOverrides((prev) => ({
            ...prev,
            [row.id]: { status: row.status, errorReason: row.content?.error?.message ?? null },
          }));
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

  function withOverride(m: MessageItem): MessageItem {
    const override = messageOverrides[m.id];
    return override ? { ...m, status: override.status, errorReason: override.errorReason } : m;
  }

  const allMessages: (MessageItem & { localStatus?: "sending" | "error" })[] = detail
    ? [
        ...detail.messages.map(withOverride),
        ...liveMessages.filter((m) => !detail.messages.some((d) => d.id === m.id)).map(withOverride),
        ...pendingMessages,
      ]
    : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [allMessages.length]);

  /** Optimistic send: an immediate "sending" bubble, reconciled by removing it
   * on success (Realtime — already wired above — delivers the server-confirmed
   * row within the same channel almost immediately) or flipped to an "error"
   * state with a retry affordance on failure. Never marks a message as sent
   * client-side; only the API route's real DB insert does that.
   *
   * Retrying (either an optimistic bubble that failed, or a real persisted
   * message YCloud later reported as "failed") always sends a brand-new
   * message rather than mutating the old one in place — the old failed
   * bubble/row stays visible as history (same as WhatsApp's own "tap to
   * resend" UX), and this app never rewrites a real message's own content. */
  async function sendMessage(body: string) {
    if (!detail || !body.trim()) return;
    const tempId = `temp-${tempIdCounter.current++}`;

    setPendingMessages((prev) => [
      ...prev,
      {
        id: tempId,
        direction: "outbound",
        senderType: "agent",
        body,
        type: "text",
        status: null,
        createdAt: new Date().toISOString(),
        errorReason: null,
        localStatus: "sending",
      },
    ]);
    setIsSending(true);

    try {
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation_id: detail.id, content: body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(errorMessageFor(data.error));

      // Success: drop the optimistic bubble — Realtime delivers the real row.
      setPendingMessages((prev) => prev.filter((m) => m.id !== tempId));
    } catch (err) {
      setPendingMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, localStatus: "error" } : m)));
      toast.error(err instanceof Error ? err.message : "No se pudo enviar el mensaje.");
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit() {
    const body = messageInput.trim();
    if (!body) return;
    setMessageInput("");
    sendMessage(body);
  }

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
              // Two distinct failure sources rendered the same way: a client-side
              // send attempt that never reached the server (localStatus), and a
              // real message YCloud/WhatsApp rejected after accepting it
              // (status === "failed", reported via whatsapp.message.updated).
              const failed = m.localStatus === "error" || m.status === "failed";
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="my-3 text-center text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                      {formatDay(m.createdAt)}
                    </div>
                  )}
                  <div className={cn("flex", outbound ? "justify-end" : "justify-start")}>
                    <div className="flex max-w-[75%] flex-col items-end gap-1">
                      <div
                        className={cn(
                          "rounded-lg px-3.5 py-2 text-sm",
                          outbound ? "bg-accent-500 text-white" : "bg-surface-2 text-foreground",
                          m.localStatus === "sending" && "opacity-60",
                          failed && "bg-error-bg text-error-strong",
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p
                          className={cn(
                            "mt-1 text-[10px]",
                            failed ? "text-error-strong" : outbound ? "text-white/70" : "text-neutral-500",
                          )}
                        >
                          {m.localStatus === "sending" ? "Enviando…" : formatTime(m.createdAt)}
                        </p>
                      </div>
                      {failed && (
                        <div className="flex flex-col items-end gap-0.5">
                          {m.errorReason && <p className="max-w-[220px] text-right text-[11px] text-error-strong">{m.errorReason}</p>}
                          <button
                            type="button"
                            onClick={() => sendMessage(m.body)}
                            className="flex items-center gap-1 text-[11px] font-medium text-error-strong hover:underline"
                          >
                            <AlertTriangle className="size-3" aria-hidden="true" />
                            No se pudo enviar — reintentar
                            <RotateCw className="size-3" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="flex items-end gap-2 border-t border-border-default bg-surface-1 p-3">
        <textarea
          value={messageInput}
          onChange={(e) => setMessageInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="Escribí un mensaje…"
          rows={1}
          className="max-h-32 flex-1 resize-none rounded-md border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!messageInput.trim() || isSending}
          aria-label="Enviar mensaje"
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Send className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
