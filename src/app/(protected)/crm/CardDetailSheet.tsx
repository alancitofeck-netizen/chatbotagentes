"use client";

import { useEffect, useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { OpportunityDetail } from "@/lib/crm/queries";
import { getOpportunityDetailAction, addOpportunityNote } from "@/lib/crm/actions";

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("es", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const COMING_SOON_TABS = ["conversaciones", "archivos", "emails", "whatsapp", "ia"];

export function CardDetailSheet({
  opportunityId,
  onClose,
}: {
  opportunityId: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<OpportunityDetail | null>(null);
  const [tab, setTab] = useState("resumen");
  const [noteBody, setNoteBody] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!opportunityId) return;
    getOpportunityDetailAction(opportunityId).then(setDetail);
  }, [opportunityId]);

  function handleAddNote() {
    if (!opportunityId || !noteBody.trim()) return;
    const body = noteBody.trim();
    setNoteBody("");
    startTransition(async () => {
      await addOpportunityNote(opportunityId, body);
      const fresh = await getOpportunityDetailAction(opportunityId);
      setDetail(fresh);
      toast.success("Nota agregada.");
    });
  }

  return (
    <Sheet open={opportunityId !== null} onClose={onClose} title={detail?.title ?? "Oportunidad"}>
      {!detail ? (
        <div className="flex flex-col gap-3 p-5">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="px-5 pt-4">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="resumen">Resumen</TabsTrigger>
                <TabsTrigger value="notas">Notas</TabsTrigger>
                <TabsTrigger value="historial">Historial</TabsTrigger>
                {COMING_SOON_TABS.map((t) => (
                  <TabsTrigger key={t} value={t} disabled>
                    {t === "ia" ? "IA" : t[0].toUpperCase() + t.slice(1)}
                  </TabsTrigger>
                ))}
              </TabsList>

              <div className="py-4">
                <TabsContent value="resumen">
                  <dl className="flex flex-col gap-3 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Valor</dt>
                      <dd className="font-mono font-semibold text-foreground">
                        {formatCurrency(detail.value, detail.currency)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Estado</dt>
                      <dd>
                        <Badge variant={detail.status === "won" ? "success" : "neutral"}>{detail.status}</Badge>
                      </dd>
                    </div>
                    <div className="my-1 h-px bg-border-default" />
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Contacto</dt>
                      <dd className="text-foreground">{detail.contact.name}</dd>
                    </div>
                    {detail.contact.company && (
                      <div className="flex items-center justify-between">
                        <dt className="text-neutral-500">Empresa</dt>
                        <dd className="text-foreground">{detail.contact.company}</dd>
                      </div>
                    )}
                    {detail.contact.email && (
                      <div className="flex items-center justify-between">
                        <dt className="text-neutral-500">Email</dt>
                        <dd className="truncate text-foreground">{detail.contact.email}</dd>
                      </div>
                    )}
                    {detail.contact.phone && (
                      <div className="flex items-center justify-between">
                        <dt className="text-neutral-500">Teléfono</dt>
                        <dd className="text-foreground">{detail.contact.phone}</dd>
                      </div>
                    )}
                  </dl>
                </TabsContent>

                <TabsContent value="notas">
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <input
                        value={noteBody}
                        onChange={(e) => setNoteBody(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                        placeholder="Agregar una nota…"
                        className="flex-1 rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
                      />
                      <Button size="sm" onClick={handleAddNote} loading={isPending}>
                        Agregar
                      </Button>
                    </div>
                    {detail.notes.length === 0 ? (
                      <p className="text-sm text-neutral-500">Sin notas todavía.</p>
                    ) : (
                      <ul className="flex flex-col gap-3">
                        {detail.notes.map((note) => (
                          <li key={note.id} className="rounded-md bg-surface-2 p-3">
                            <p className="text-sm text-foreground">{note.body}</p>
                            <p className="mt-1 text-xs text-neutral-500">{formatDate(note.createdAt)}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="historial">
                  <p className="text-sm text-neutral-500">
                    Oportunidad creada el {formatDate(detail.createdAt)}.
                  </p>
                </TabsContent>

                {COMING_SOON_TABS.map((t) => (
                  <TabsContent key={t} value={t}>
                    <p className="text-sm text-neutral-500">Disponible cuando se active el módulo de Inbox.</p>
                  </TabsContent>
                ))}
              </div>
            </Tabs>
          </div>
        </div>
      )}
    </Sheet>
  );
}
