"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { testAgentAction } from "@/lib/ai-agents/actions";

interface TurnResult {
  message: string;
  reply: string | null;
  toolTrace: { name: string; arguments: unknown; result: unknown }[];
  error?: string;
}

export function TestTab({ agentId }: { agentId: string }) {
  const [message, setMessage] = useState("");
  const [turns, setTurns] = useState<TurnResult[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleSend() {
    if (!message.trim()) return;
    const sentMessage = message.trim();
    setMessage("");
    startTransition(async () => {
      const result = await testAgentAction(agentId, sentMessage);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setTurns((prev) => [...prev, { message: sentMessage, reply: result.reply, toolTrace: result.toolTrace }]);
    });
  }

  return (
    <Card>
      <CardHeader title="Chat de prueba" />
      <p className="mb-3 text-sm text-neutral-500">
        Conversá con el agente sin afectar conversaciones reales — no se envía nada por WhatsApp.
      </p>

      <div className="mb-3 flex flex-col gap-3 rounded-md border border-border-default bg-surface-2 p-3">
        {turns.length === 0 ? (
          <p className="text-sm text-neutral-500">Escribí un mensaje para empezar.</p>
        ) : (
          turns.map((t, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex justify-end">
                <p className="max-w-[80%] rounded-2xl rounded-br-md bg-accent-500 px-3 py-2 text-sm text-white">{t.message}</p>
              </div>
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl rounded-bl-md bg-surface-1 px-3 py-2 text-sm shadow-[var(--elevation-xs)]">
                  <p className="mb-1 flex items-center gap-1 text-[11px] font-medium text-accent-700">
                    <Sparkles className="size-3" aria-hidden="true" /> Agente
                  </p>
                  <p className="whitespace-pre-wrap text-foreground">{t.reply ?? "(sin respuesta final — ver tools abajo)"}</p>
                  {t.toolTrace.length > 0 && (
                    <ul className="mt-1.5 flex flex-col gap-0.5 border-t border-border-default pt-1.5">
                      {t.toolTrace.map((call, j) => (
                        <li key={j} className="text-[11px] text-neutral-500">
                          <span className="font-mono">{call.name}</span>({JSON.stringify(call.arguments)}) → {JSON.stringify(call.result)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          rows={2}
          placeholder="Escribí como si fueras el contacto…"
          className="flex-1 rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />
        <Button onClick={handleSend} loading={isPending}>
          Enviar
        </Button>
      </div>
    </Card>
  );
}
