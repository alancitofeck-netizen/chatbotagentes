"use client";

import { useEffect, useState } from "react";
import { Sparkles, AlertTriangle, Info, MessageCircle, Mail, Copy, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/toast/toast";
import type { RankedCollectionItem } from "@/lib/collections/insights";
import { getCollectionsPriorityRankingAction, generateCollectionMessageAction } from "@/lib/collections/actions";
import { formatCurrency } from "@/lib/utils/format";

const FLAG_ICON = { info: Info, warning: AlertTriangle, error: AlertTriangle } as const;
const FLAG_VARIANT = { info: "info", warning: "warning", error: "error" } as const;

function formatDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "2-digit", month: "short" });
}

/** Panel de IA de Cobranza — el ranking y las señales de riesgo son 100%
 * determinísticos (insights.ts, sin LLM); lo único que llama a un modelo acá
 * es "Generar mensaje", bajo demanda y por fila. Sin ningún puntaje o
 * "% de probabilidad de pago" — decisión explícita del módulo, confirmada
 * con el usuario antes de construir esto. */
export function CollectionsPriorityView({ onOpen }: { onOpen: (paymentId: string) => void }) {
  const [ranked, setRanked] = useState<RankedCollectionItem[] | null>(null);
  const [messageFor, setMessageFor] = useState<{ id: string; channel: "email" | "whatsapp"; text: string } | null>(null);
  const [generatingFor, setGeneratingFor] = useState<string | null>(null);

  useEffect(() => {
    getCollectionsPriorityRankingAction().then(setRanked);
  }, []);

  function handleGenerate(item: RankedCollectionItem, channel: "email" | "whatsapp") {
    setGeneratingFor(item.id);
    setMessageFor(null);
    generateCollectionMessageAction(item.id, channel)
      .then((result) => {
        if (typeof result !== "string") {
          toast.error(result.error);
          return;
        }
        setMessageFor({ id: item.id, channel, text: result });
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo generar el mensaje."))
      .finally(() => setGeneratingFor(null));
  }

  function handleCopy(text: string) {
    navigator.clipboard.writeText(text);
    toast.success("Mensaje copiado.");
  }

  if (!ranked) {
    return (
      <div className="flex flex-col gap-3 px-4 sm:px-6 lg:px-8">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (ranked.length === 0) {
    return (
      <div className="px-4 sm:px-6 lg:px-8">
        <EmptyState icon={Sparkles} title="Cartera al día" description="No hay cobros pendientes, en seguimiento o vencidos para priorizar." />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 sm:px-6 lg:px-8">
      <div className="flex items-start gap-2 rounded-md bg-accent-50 p-3 text-xs text-accent-700">
        <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Orden calculado con una fórmula fija (monto × urgencia según días de mora/anticipación) — no es una predicción de IA. Las señales de riesgo salen de datos reales del cobro, nunca de un puntaje inventado.
      </div>

      <ul className="flex flex-col gap-2">
        {ranked.map((item, i) => (
          <li key={item.id} className="flex flex-col gap-2 rounded-lg border border-border-default bg-surface-1 p-4">
            <div className="flex items-start justify-between gap-3">
              <button type="button" onClick={() => onOpen(item.id)} className="text-left">
                <p className="text-sm font-medium text-foreground">
                  #{i + 1} · {item.contactName}
                </p>
                <p className="text-xs text-neutral-500">
                  {item.company}
                  {item.policyNumber ? ` · ${item.policyNumber}` : ""} · vence {formatDate(item.dueDate)}
                </p>
              </button>
              <span className="font-mono text-sm font-semibold text-foreground">{formatCurrency(item.amount, item.currency)}</span>
            </div>

            {item.riskFlags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {item.riskFlags.map((flag, idx) => {
                  const Icon = FLAG_ICON[flag.level];
                  return (
                    <Badge key={idx} variant={FLAG_VARIANT[flag.level]}>
                      <Icon className="size-3" aria-hidden="true" />
                      {flag.label}
                    </Badge>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={generatingFor === item.id}
                onClick={() => handleGenerate(item, "whatsapp")}
                className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1 text-xs text-foreground hover:bg-surface-2 disabled:opacity-40"
              >
                {generatingFor === item.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <MessageCircle className="size-3.5" aria-hidden="true" />}
                Mensaje WhatsApp
              </button>
              <button
                type="button"
                disabled={generatingFor === item.id}
                onClick={() => handleGenerate(item, "email")}
                className="inline-flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1 text-xs text-foreground hover:bg-surface-2 disabled:opacity-40"
              >
                {generatingFor === item.id ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Mail className="size-3.5" aria-hidden="true" />}
                Mensaje email
              </button>
            </div>

            {messageFor?.id === item.id && (
              <div className="flex flex-col gap-2 rounded-md bg-surface-2 p-3">
                <p className="whitespace-pre-wrap text-xs text-foreground">{messageFor.text}</p>
                <button
                  type="button"
                  onClick={() => handleCopy(messageFor.text)}
                  className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-accent-700 hover:text-accent-800"
                >
                  <Copy className="size-3.5" aria-hidden="true" />
                  Copiar
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
