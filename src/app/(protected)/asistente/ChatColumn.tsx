"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Bot, Check, X, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { toast } from "@/components/toast/toast";
import type { AssistantMessageView, AssistantToolCallView } from "@/lib/assistant/actions";
import { sendAssistantMessageAction, getPendingToolCallsAction, confirmToolCallAction, rejectToolCallAction, getConversationMessagesAction } from "@/lib/assistant/actions";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
}

function ToolConfirmCard({ toolCall, onResolved }: { toolCall: AssistantToolCallView; onResolved: (reply: string | null) => void }) {
  const [busy, setBusy] = useState<"confirm" | "reject" | null>(null);
  const resolved = toolCall.status !== "proposed";

  async function handleConfirm() {
    setBusy("confirm");
    try {
      const result = await confirmToolCallAction(toolCall.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      onResolved(result.reply);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo confirmar.");
    } finally {
      setBusy(null);
    }
  }

  async function handleReject() {
    setBusy("reject");
    try {
      await rejectToolCallAction(toolCall.id);
      onResolved(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cancelar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex max-w-[85%] flex-col gap-2 rounded-xl border border-dashed border-accent-500/40 bg-accent-50 px-3.5 py-3 text-sm">
      <p className="flex items-center gap-1.5 font-medium text-accent-700">
        <Sparkles className="size-3.5" aria-hidden="true" />
        {toolCall.toolLabel}
      </p>
      <ul className="flex flex-col gap-0.5 text-xs text-accent-700/80">
        {Object.entries(toolCall.arguments).map(([k, v]) => (
          <li key={k}>
            <span className="font-medium">{k}:</span> {String(v)}
          </li>
        ))}
      </ul>
      {resolved ? (
        <p className="text-xs italic text-accent-700/70">{toolCall.status === "rejected" ? "Cancelado." : "Ya se ejecutó."}</p>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 rounded-md bg-accent-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-600 disabled:opacity-50"
          >
            {busy === "confirm" ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Check className="size-3.5" aria-hidden="true" />}
            Confirmar
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={busy !== null}
            className="inline-flex items-center gap-1 rounded-md border border-border-strong px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface-2 disabled:opacity-50"
          >
            {busy === "reject" ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <X className="size-3.5" aria-hidden="true" />}
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

export function ChatColumn({ conversationId, initialMessages }: { conversationId: string; initialMessages: AssistantMessageView[] }) {
  const [messages, setMessages] = useState(initialMessages);
  const [toolCallsByMessage, setToolCallsByMessage] = useState<Record<string, AssistantToolCallView[]>>({});
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const pendingIds = messages.flatMap((m) => m.pendingToolCallIds).filter((id) => !toolCallsByMessage[id]);
    if (pendingIds.length === 0) return;
    getPendingToolCallsAction(pendingIds).then((calls) => {
      setToolCallsByMessage((prev) => {
        const next = { ...prev };
        for (const call of calls) next[call.id] = [call];
        return next;
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft("");
    setSending(true);
    setMessages((prev) => [...prev, { id: `optimistic-${Date.now()}`, role: "user", content: text, pendingToolCallIds: [], createdAt: new Date().toISOString() }]);

    try {
      const result = await sendAssistantMessageAction(conversationId, text);
      if ("error" in result) {
        toast.error(result.error);
        const fresh = await getConversationMessagesAction(conversationId);
        setMessages(fresh);
        return;
      }
      const fresh = await getConversationMessagesAction(conversationId);
      setMessages(fresh);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  async function handleToolResolved() {
    const fresh = await getConversationMessagesAction(conversationId);
    setMessages(fresh);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-surface-1 shadow-[var(--elevation-sm)]">
      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-neutral-500">
            <Bot className="size-8" aria-hidden="true" />
            <p className="text-sm">Pedime lo que necesites — &ldquo;¿cómo va mi día?&rdquo;, &ldquo;creá una tarea para llamar a Pedro&rdquo;, &ldquo;mové a María a Cerrado&rdquo;…</p>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={cn("flex flex-col gap-1.5", m.role === "user" ? "items-end" : "items-start")}>
            <div
              className={cn(
                "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm shadow-[var(--elevation-xs)]",
                m.role === "user" ? "rounded-br-md bg-accent-500 text-white" : "rounded-bl-md bg-surface-2 text-foreground",
              )}
            >
              {m.content}
            </div>
            <span className="px-1 text-[11px] text-neutral-400">{formatTime(m.createdAt)}</span>
            {m.pendingToolCallIds.map((id) => {
              const calls = toolCallsByMessage[id];
              if (!calls) return null;
              return calls.map((call) => <ToolConfirmCard key={call.id} toolCall={call} onResolved={handleToolResolved} />);
            })}
          </div>
        ))}
        {sending && (
          <div className="flex items-center gap-2 self-start rounded-2xl rounded-bl-md bg-surface-2 px-3.5 py-2 text-sm text-neutral-500">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Pensando…
          </div>
        )}
      </div>

      <div className="flex items-end gap-2 border-t border-border-default p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Escribí un mensaje…"
          rows={1}
          className="max-h-32 flex-1 resize-none rounded-2xl border border-border-strong bg-surface-2 px-3.5 py-2.5 text-sm outline-none focus:border-accent-500 focus:bg-surface-1 focus:ring-[3px] focus:ring-accent-100"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={sending || !draft.trim()}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-500 text-white transition-colors hover:bg-accent-600 disabled:opacity-40"
          aria-label="Enviar"
        >
          <Send className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
