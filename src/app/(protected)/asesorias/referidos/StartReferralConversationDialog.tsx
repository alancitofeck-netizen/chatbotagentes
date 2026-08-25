"use client";

import { useEffect, useState, useTransition } from "react";
import { Rocket } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { ReferralRow } from "@/lib/asesorias/referrals";
import { startReferralConversationAction, sendReferralConversationMessageAction } from "@/lib/asesorias/actions";

/** "🚀 Iniciar conversación" (Fase 4, Agentes IA de Referidos) — resuelve el
 * agente de referidos y genera el mensaje inicial al montar; el asesor
 * SIEMPRE puede editarlo antes de enviar (pedido explícito, nunca envío
 * automático). Recién al confirmar se manda por WhatsApp y la conversación
 * pasa a mode:'ai' (sendReferralConversationMessageAction). */
export function StartReferralConversationDialog({
  referral,
  onClose,
  onSent,
}: {
  referral: ReferralRow;
  onClose: () => void;
  onSent: () => void;
}) {
  const [state, setState] = useState<"loading" | "draft" | "error">("loading");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, startTransition] = useTransition();

  useEffect(() => {
    startReferralConversationAction(referral.id).then((result) => {
      if (result.ok) {
        setConversationId(result.conversationId);
        setMessage(result.draftMessage);
        setState("draft");
      } else {
        setError(result.error);
        setState("error");
      }
    });
  }, [referral.id]);

  function handleSend() {
    if (!conversationId) return;
    if (!message.trim()) {
      toast.error("El mensaje no puede estar vacío.");
      return;
    }
    startTransition(async () => {
      const result = await sendReferralConversationMessageAction(conversationId, message);
      if (result.ok) {
        toast.success("Conversación iniciada.");
        onSent();
        onClose();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Sheet open onClose={onClose} title="Iniciar conversación">
      <div className="flex flex-col gap-4 p-5">
        <div className="text-sm text-neutral-500">
          Para <span className="font-medium text-foreground">{referral.name}</span> · +{referral.phone}
        </div>

        {state === "loading" && <p className="text-sm text-neutral-500">Generando mensaje inicial con el Agente IA de Referidos…</p>}

        {state === "error" && <p className="text-sm text-error-strong">{error}</p>}

        {state === "draft" && (
          <>
            <div>
              <label className="text-sm font-medium text-foreground">Mensaje inicial</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={6}
                className="mt-1.5 w-full rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
              />
              <p className="mt-1.5 text-xs text-neutral-500">Generado por el Agente IA de Referidos — podés editarlo antes de enviarlo.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={onClose} disabled={isSending}>
                Cancelar
              </Button>
              <Button onClick={handleSend} loading={isSending}>
                <Rocket className="size-4" aria-hidden="true" />
                Enviar WhatsApp
              </Button>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
