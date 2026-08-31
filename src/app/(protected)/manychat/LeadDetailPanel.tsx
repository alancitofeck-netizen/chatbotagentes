"use client";

import { useEffect, useState } from "react";
import { Bot, User } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { getManychatLeadDetailAction, getManychatLeadsAction } from "@/lib/integrations/actions";
import type { ManychatLeadDetail } from "@/lib/integrations/manychat";

const LEVEL_LABEL: Record<string, string> = { none: "Sin interacción", low: "Baja", medium: "Media", high: "Alta" };
const LEVEL_VARIANT: Record<string, "neutral" | "warning" | "info" | "success"> = { none: "neutral", low: "warning", medium: "info", high: "success" };

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Ficha del lead — master-detail sobre lo ya construido para el panel del
 * Inbox (getManychatLeadDetail reusado tal cual, nunca duplicado). Muestra
 * únicamente actividad/datos reales — Origen queda oculto entero si
 * source/content_name/entry_point nunca se configuraron (ver nota en
 * ManychatWebhookPayload), en vez de mostrar campos vacíos. */
export function LeadDetailPanel({ contactId, onClose }: { contactId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<ManychatLeadDetail | null | undefined>(undefined);
  const [name, setName] = useState<string>("Lead de Instagram");

  useEffect(() => {
    let cancelled = false;
    getManychatLeadDetailAction(contactId).then((d) => {
      if (!cancelled) setDetail(d);
    });
    // Nombre real — ya lo tiene la lista cargada en memoria, evita un
    // segundo query solo para un string que ya está disponible.
    getManychatLeadsAction().then((leads) => {
      if (cancelled) return;
      const match = leads.find((l) => l.contactId === contactId);
      if (match) setName(match.name);
    });
    return () => {
      cancelled = true;
    };
  }, [contactId]);

  const hasOrigin = Boolean(detail?.source || detail?.contentName || detail?.entryPoint || detail?.campaign);
  const capturedEntries = detail ? Object.entries(detail.capturedData) : [];

  return (
    <Sheet open onClose={onClose} title={name} className="max-w-2xl">
      <div className="flex flex-col gap-4 p-5">
        {detail === undefined && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        )}

        {detail === null && <p className="text-sm text-neutral-500">Este contacto no tiene actividad de ManyChat registrada.</p>}

        {detail && (
          <>
            {detail.instagramUsername && (
              <div className="flex items-center gap-2 text-sm text-neutral-500">
                <span>@{detail.instagramUsername}</span>
                <Badge variant="accent">Instagram / ManyChat</Badge>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Card>
                <p className="text-xs text-neutral-500">Nivel de interacción</p>
                <Badge variant={LEVEL_VARIANT[detail.interactionLevel]}>{LEVEL_LABEL[detail.interactionLevel]}</Badge>
              </Card>
              <Card>
                <p className="mb-1 text-xs text-neutral-500">Interaction Score</p>
                <p className="font-mono text-lg font-semibold text-foreground">{detail.interactionScore}/100</p>
                <ProgressBar value={detail.interactionScore} variant={detail.interactionScore >= 65 ? "success" : detail.interactionScore >= 30 ? "warning" : "error"} />
              </Card>
            </div>

            {hasOrigin && (
              <Card>
                <CardHeader title="Origen" />
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {detail.source && (
                    <div>
                      <dt className="text-xs text-neutral-500">Fuente</dt>
                      <dd className="capitalize text-foreground">{detail.source}</dd>
                    </div>
                  )}
                  {detail.contentName && (
                    <div>
                      <dt className="text-xs text-neutral-500">Contenido</dt>
                      <dd className="text-foreground">{detail.contentName}</dd>
                    </div>
                  )}
                  {detail.entryPoint && (
                    <div>
                      <dt className="text-xs text-neutral-500">Entry Point</dt>
                      <dd className="text-foreground">{detail.entryPoint}</dd>
                    </div>
                  )}
                  {detail.campaign && (
                    <div>
                      <dt className="text-xs text-neutral-500">Campaña</dt>
                      <dd className="text-foreground">{detail.campaign}</dd>
                    </div>
                  )}
                </dl>
              </Card>
            )}

            <Card>
              <CardHeader title="Interacción" />
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-neutral-500">Primera interacción</dt>
                  <dd className="text-foreground">{formatDateTime(detail.firstInteractionAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Última interacción</dt>
                  <dd className="text-foreground">{formatDateTime(detail.lastInteractionAt)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Mensajes del lead</dt>
                  <dd className="font-mono text-foreground">{detail.leadMessageCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Mensajes de ManyChat</dt>
                  <dd className="font-mono text-foreground">{detail.manychatMessageCount}</dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Total</dt>
                  <dd className="font-mono font-semibold text-foreground">{detail.leadMessageCount + detail.manychatMessageCount}</dd>
                </div>
              </dl>
            </Card>

            {capturedEntries.length > 0 && (
              <Card>
                <CardHeader title="Datos capturados" />
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  {capturedEntries.map(([key, value]) => (
                    <div key={key}>
                      <dt className="text-xs capitalize text-neutral-500">{key}</dt>
                      <dd className="text-foreground">{String(value)}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            )}

            <Card>
              <CardHeader title="Conversación" />
              {detail.messages.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  ManyChat no mandó mensajes individuales para este lead — solo datos de actividad. Si tu flujo incluye el texto del mensaje en
                  cada evento, va a aparecer acá.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {detail.messages.map((m) => (
                    <div key={m.id} className={`flex items-start gap-2 ${m.direction === "outbound" ? "flex-row-reverse text-right" : ""}`}>
                      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-neutral-500">
                        {m.direction === "outbound" ? <Bot className="size-3.5" aria-hidden="true" /> : <User className="size-3.5" aria-hidden="true" />}
                      </span>
                      <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.direction === "outbound" ? "bg-accent-500 text-white" : "bg-surface-2 text-foreground"}`}>
                        <p>{m.body}</p>
                        <p className={`mt-0.5 text-[11px] ${m.direction === "outbound" ? "text-white/70" : "text-neutral-400"}`}>{formatDateTime(m.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </Sheet>
  );
}
