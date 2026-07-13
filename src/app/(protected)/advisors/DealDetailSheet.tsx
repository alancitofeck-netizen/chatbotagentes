"use client";

import { useEffect, useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { DealDetail } from "@/lib/advisors/queries";
import { getDealDetailAction, addDealNote } from "@/lib/advisors/actions";
import { formatCurrency } from "@/lib/utils/format";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function DealDetailSheet({
  opportunityId,
  onClose,
  onEdit,
  onDelete,
}: {
  opportunityId: string | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: (opportunityId: string) => void;
}) {
  const [detail, setDetail] = useState<DealDetail | null>(null);
  const [tab, setTab] = useState("resumen");
  const [noteBody, setNoteBody] = useState("");
  const [isPending, startTransition] = useTransition();

  // Caller (AdvisorsBoardShell) remounts this via a key tied to opportunityId,
  // same pattern as CardDetailSheet.tsx — no need to reset state manually.
  useEffect(() => {
    if (!opportunityId) return;
    getDealDetailAction(opportunityId).then(setDetail);
  }, [opportunityId]);

  function handleAddNote() {
    if (!opportunityId || !noteBody.trim()) return;
    const body = noteBody.trim();
    setNoteBody("");
    startTransition(async () => {
      await addDealNote(opportunityId, body);
      const fresh = await getDealDetailAction(opportunityId);
      setDetail(fresh);
      toast.success("Nota agregada.");
    });
  }

  return (
    <Sheet open={opportunityId !== null} onClose={onClose} title={detail?.title ?? "Póliza"}>
      {!detail ? (
        <div className="flex flex-col gap-3 p-5">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="px-5 pt-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="notas">Notas</TabsTrigger>
            </TabsList>

            <div className="py-4">
              <TabsContent value="resumen">
                <dl className="flex flex-col gap-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-neutral-500">Valor</dt>
                    <dd className="font-mono font-semibold text-foreground">{formatCurrency(detail.value, detail.currency)}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-neutral-500">Estado</dt>
                    <dd>
                      <Badge variant={detail.status === "won" ? "success" : "neutral"}>{detail.status}</Badge>
                    </dd>
                  </div>
                  {detail.policyType && (
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Tipo de póliza</dt>
                      <dd className="text-foreground">{detail.policyType}</dd>
                    </div>
                  )}
                  {detail.renewalDate && (
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Renovación</dt>
                      <dd className="text-foreground">{new Date(detail.renewalDate).toLocaleDateString("es")}</dd>
                    </div>
                  )}
                  {detail.commission !== null && (
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Comisión</dt>
                      <dd className="font-mono text-foreground">{formatCurrency(detail.commission, detail.currency)}</dd>
                    </div>
                  )}
                  <div className="my-1 h-px bg-border-default" />
                  <div className="flex items-center justify-between">
                    <dt className="text-neutral-500">Cliente</dt>
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
                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" size="sm" onClick={onEdit}>
                    Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => detail && onDelete(detail.id)}>
                    Eliminar
                  </Button>
                </div>
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
            </div>
          </Tabs>
        </div>
      )}
    </Sheet>
  );
}
