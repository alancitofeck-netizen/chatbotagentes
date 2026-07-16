"use client";

import { useEffect, useRef, useState } from "react";
import {
  Building2,
  Phone,
  MessageSquare,
  ChevronLeft,
  Send,
  RotateCw,
  AlertTriangle,
  Paperclip,
  Sparkles,
  Check,
  CheckCheck,
  Clock,
  Info,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { createClient } from "@/lib/supabase/client";
import { toast } from "@/components/toast/toast";
import type { ConversationDetail, MessageItem } from "@/lib/inbox/queries";
import { approveDraftMessage, editDraftMessage, rejectDraftMessage } from "@/lib/inbox/actions";
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
  ycloud_not_configured: "Este workspace no tiene conectada una integración de WhatsApp (Configuración → Integraciones).",
  ycloud_send_failed: "YCloud rechazó el envío del mensaje.",
  ycloud_network_error: "No se pudo contactar a YCloud. Revisá tu conexión e intentá de nuevo.",
  content_too_long: "El mensaje es demasiado largo (máximo 4096 caracteres).",
  conversation_not_found: "No se encontró la conversación.",
  unauthorized: "Tu sesión expiró. Volvé a iniciar sesión.",
  draft_not_found: "Esta sugerencia ya no existe.",
  outside_24h_window: "Pasaron más de 24h desde el último mensaje del contacto — no se puede enviar sin una plantilla aprobada.",
  persist_failed: "El mensaje se envió pero no se pudo guardar — revisá el historial de WhatsApp.",
};

function errorMessageFor(code: string | undefined): string {
  return ERROR_MESSAGES[code ?? ""] ?? "No se pudo enviar el mensaje.";
}

/** Client-only canned phrases (no backend/persistence — no templates table
 * exists yet) inserted into the composer via the "Respuestas rápidas" popover. */
const QUICK_REPLIES = [
  "¡Hola! ¿En qué puedo ayudarte hoy?",
  "Dame un momento para revisarlo.",
  "¿Podrías darme más detalles, por favor?",
  "Gracias por tu paciencia.",
  "¿Hay algo más en lo que pueda ayudarte?",
  "En breve te contactamos con más información.",
];

/** Purely visual mapping over the real `messages.status` field (already
 * written by processMessageStatusUpdate, src/app/api/webhooks/ycloud/route.ts)
 * — no new status values, just WhatsApp-style tick icons for outbound messages. */
function MessageStatusIcon({ status, sending }: { status: string | null; sending: boolean }) {
  if (sending) return <Clock className="size-3" aria-hidden="true" />;
  if (status === "read") return <CheckCheck className="size-3.5 text-accent-200" aria-hidden="true" />;
  if (status === "delivered") return <CheckCheck className="size-3.5" aria-hidden="true" />;
  if (status === "sent" || status === "accepted") return <Check className="size-3.5" aria-hidden="true" />;
  return null;
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
  const [quickRepliesOpen, setQuickRepliesOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const quickRepliesRef = useRef<HTMLDivElement>(null);
  // A ref counter (not Date.now()/Math.random()) for temp-id generation —
  // those are impure calls the react-hooks/purity rule flags even inside an
  // event handler defined in the component body.
  const tempIdCounter = useRef(0);

  const [messageOverrides, setMessageOverrides] = useState<Record<string, { status: string | null; errorReason: string | null }>>(
    {},
  );

  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [draftEditText, setDraftEditText] = useState("");
  const [draftActionPending, setDraftActionPending] = useState<string | null>(null);

  async function handleApproveDraft(messageId: string) {
    setDraftActionPending(messageId);
    try {
      const result = await approveDraftMessage(messageId);
      if (!result.ok) {
        toast.error(errorMessageFor(result.error));
        return;
      }
      toast.success("Mensaje enviado.");
    } finally {
      setDraftActionPending(null);
    }
  }

  async function handleRejectDraft(messageId: string) {
    setDraftActionPending(messageId);
    try {
      await rejectDraftMessage(messageId);
      toast.success("Sugerencia rechazada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo rechazar la sugerencia.");
    } finally {
      setDraftActionPending(null);
    }
  }

  function startEditingDraft(m: MessageItem) {
    setEditingDraftId(m.id);
    setDraftEditText(m.body);
  }

  async function handleSaveDraftEdit(messageId: string) {
    setDraftActionPending(messageId);
    try {
      await editDraftMessage(messageId, draftEditText);
      setEditingDraftId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo editar el borrador.");
    } finally {
      setDraftActionPending(null);
    }
  }

  useEffect(() => {
    if (!detail) return;
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    type MessageRow = {
      id: string;
      direction: string;
      sender_type: string;
      type: string;
      content: { body?: string; error?: { message?: string } } | null;
      status: string | null;
      created_at: string;
    };

    // `createBrowserClient` (@supabase/ssr) hydrates the session from cookies
    // asynchronously — subscribing immediately joins the Realtime socket
    // before the user's JWT is attached, so Postgres RLS sees an anonymous
    // connection and silently filters out every change (join still succeeds,
    // "Subscribed to PostgreSQL" still fires, but no event ever arrives).
    // Explicitly awaiting the session + setAuth before subscribing fixes it
    // (confirmed live via WS-frame instrumentation — see the same fix in
    // src/app/(protected)/contacts/ContactsShell.tsx).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session) return;
      supabase.realtime.setAuth(session.access_token);
      channel = supabase
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
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
    // Deliberately keyed only on the id: `detail` also changes reference after
    // refetchDetail() (note/tag/status edits), which shouldn't tear down and
    // recreate the Realtime channel for the same conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail?.id]);

  useEffect(() => {
    if (!quickRepliesOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (quickRepliesRef.current && !quickRepliesRef.current.contains(e.target as Node)) {
        setQuickRepliesOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [quickRepliesOpen]);

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

  function insertQuickReply(text: string) {
    setMessageInput((prev) => (prev ? `${prev} ${text}` : text));
    setQuickRepliesOpen(false);
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
      <div className="flex h-full flex-1 items-center justify-center bg-surface-2">
        <EmptyState
          icon={MessageSquare}
          title="Elegí una conversación"
          description="Seleccioná un contacto de la lista para ver el historial."
        />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col bg-surface-2">
      <div className="flex items-center justify-between gap-3 border-b border-border-default bg-surface-1 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver a la lista"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2 hover:text-foreground lg:hidden"
          >
            <ChevronLeft size={18} />
          </button>
          <Avatar name={detail.contact.name} src={detail.contact.avatarUrl} size={38} />
          <div>
            <p className="text-sm font-semibold text-foreground">{detail.contact.name}</p>
            <p className="flex items-center gap-1.5 text-xs text-neutral-500">
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
          aria-label="Ver detalles del contacto"
          className="flex items-center gap-1.5 rounded-full border border-border-strong px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-2 lg:hidden"
        >
          <Info size={14} /> Detalles
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {allMessages.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin mensajes todavía.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {allMessages.map((m, i) => {
              const outbound = m.direction === "outbound";
              const showDay = i === 0 || formatDay(allMessages[i - 1].createdAt) !== formatDay(m.createdAt);
              const prevSameSender = i > 0 && !showDay && allMessages[i - 1].direction === m.direction;
              // Two distinct failure sources rendered the same way: a client-side
              // send attempt that never reached the server (localStatus), and a
              // real message YCloud/WhatsApp rejected after accepting it
              // (status === "failed", reported via whatsapp.message.updated).
              const failed = m.localStatus === "error" || m.status === "failed";
              const isDraft = m.status === "draft";
              return (
                <div key={m.id}>
                  {showDay && (
                    <div className="my-4 flex justify-center">
                      <span className="rounded-full bg-surface-3 px-3 py-1 text-[11px] font-medium text-neutral-500">
                        {formatDay(m.createdAt)}
                      </span>
                    </div>
                  )}
                  {isDraft ? (
                    <div className="mt-2 flex justify-end">
                      <div className="flex max-w-[70%] flex-col gap-1.5 rounded-2xl rounded-br-md border border-dashed border-accent-300 bg-accent-50 px-3.5 py-2 text-sm">
                        <p className="flex items-center gap-1 text-[11px] font-medium text-accent-700">
                          <Sparkles className="size-3" aria-hidden="true" />
                          Sugerencia de IA — sin enviar
                        </p>
                        {editingDraftId === m.id ? (
                          <>
                            <textarea
                              value={draftEditText}
                              onChange={(e) => setDraftEditText(e.target.value)}
                              rows={3}
                              className="w-full rounded-md border border-border-strong bg-surface-1 px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent-500"
                            />
                            <div className="flex justify-end gap-2 text-[11px] font-medium">
                              <button type="button" onClick={() => setEditingDraftId(null)} className="text-neutral-500 hover:underline">
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={draftActionPending === m.id}
                                onClick={() => handleSaveDraftEdit(m.id)}
                                className="text-accent-700 hover:underline disabled:opacity-50"
                              >
                                Guardar
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <p className="whitespace-pre-wrap break-words text-foreground">{m.body}</p>
                            <div className="flex justify-end gap-3 text-[11px] font-medium">
                              <button
                                type="button"
                                disabled={draftActionPending === m.id}
                                onClick={() => handleRejectDraft(m.id)}
                                className="text-error-strong hover:underline disabled:opacity-50"
                              >
                                Rechazar
                              </button>
                              <button
                                type="button"
                                disabled={draftActionPending === m.id}
                                onClick={() => startEditingDraft(m)}
                                className="text-neutral-600 hover:underline disabled:opacity-50"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                disabled={draftActionPending === m.id}
                                onClick={() => handleApproveDraft(m.id)}
                                className="text-accent-700 hover:underline disabled:opacity-50"
                              >
                                Aprobar y enviar
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                  <div className={cn("flex", outbound ? "justify-end" : "justify-start", prevSameSender ? "mt-0.5" : "mt-2")}>
                    <div className="flex max-w-[70%] flex-col items-end gap-1">
                      <div
                        className={cn(
                          "px-3.5 py-2 text-sm shadow-[var(--elevation-xs)]",
                          outbound
                            ? "rounded-2xl rounded-br-md bg-accent-500 text-white"
                            : "rounded-2xl rounded-bl-md bg-surface-1 text-foreground",
                          m.localStatus === "sending" && "opacity-60",
                          failed && "bg-error-bg text-error-strong",
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p
                          className={cn(
                            "mt-1 flex items-center justify-end gap-1 text-[10px]",
                            failed ? "text-error-strong" : outbound ? "text-white/70" : "text-neutral-500",
                          )}
                        >
                          {formatTime(m.createdAt)}
                          {outbound && !failed && (
                            <MessageStatusIcon status={m.status} sending={m.localStatus === "sending"} />
                          )}
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
                  )}
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <div className="border-t border-border-default bg-surface-1 p-3">
        <div className="flex items-end gap-2">
          <button
            type="button"
            disabled
            title="Próximamente — requiere Supabase Storage"
            aria-label="Adjuntar archivo (próximamente)"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-400 disabled:cursor-not-allowed"
          >
            <Paperclip size={17} />
          </button>

          <div className="relative shrink-0" ref={quickRepliesRef}>
            <button
              type="button"
              onClick={() => setQuickRepliesOpen((v) => !v)}
              aria-label="Respuestas rápidas"
              aria-expanded={quickRepliesOpen}
              className={cn(
                "flex size-9 items-center justify-center rounded-full transition-colors",
                quickRepliesOpen ? "bg-accent-100 text-accent-700" : "text-neutral-500 hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Sparkles size={17} />
            </button>
            {quickRepliesOpen && (
              <div className="absolute bottom-11 left-0 z-10 w-72 rounded-md border border-border-default bg-surface-1 py-1.5 shadow-[var(--elevation-md)]">
                <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400">
                  Respuestas rápidas
                </p>
                <ul className="flex max-h-64 flex-col overflow-y-auto">
                  {QUICK_REPLIES.map((text) => (
                    <li key={text}>
                      <button
                        type="button"
                        onClick={() => insertQuickReply(text)}
                        className="w-full px-3 py-2 text-left text-[13px] text-foreground hover:bg-surface-2"
                      >
                        {text}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

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
            className="max-h-32 flex-1 resize-none rounded-2xl border border-border-strong bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent-500 focus:bg-surface-1 focus:ring-[3px] focus:ring-accent-100"
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
    </div>
  );
}
