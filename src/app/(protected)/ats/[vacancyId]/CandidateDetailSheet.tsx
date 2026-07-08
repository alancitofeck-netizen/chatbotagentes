"use client";

import { useEffect, useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { CandidateApplicationDetail } from "@/lib/ats/queries";
import { getCandidateApplicationDetailAction, addCandidateNote } from "@/lib/ats/actions";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const COMING_SOON_TABS = ["entrevistas", "evaluaciones", "cv"];

export function CandidateDetailSheet({
  applicationId,
  onClose,
}: {
  applicationId: string | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<CandidateApplicationDetail | null>(null);
  const [tab, setTab] = useState("resumen");
  const [noteBody, setNoteBody] = useState("");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!applicationId) return;
    getCandidateApplicationDetailAction(applicationId).then(setDetail);
  }, [applicationId]);

  function handleAddNote() {
    if (!applicationId || !noteBody.trim()) return;
    const body = noteBody.trim();
    setNoteBody("");
    startTransition(async () => {
      await addCandidateNote(applicationId, body);
      const fresh = await getCandidateApplicationDetailAction(applicationId);
      setDetail(fresh);
      toast.success("Nota agregada.");
    });
  }

  return (
    <Sheet open={applicationId !== null} onClose={onClose} title={detail?.candidate.contact.name ?? "Candidato"}>
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
              <TabsTrigger value="historial">Historial</TabsTrigger>
              {COMING_SOON_TABS.map((t) => (
                <TabsTrigger key={t} value={t} disabled>
                  {t === "cv" ? "CV" : t[0].toUpperCase() + t.slice(1)}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="py-4">
              <TabsContent value="resumen">
                <dl className="flex flex-col gap-3 text-sm">
                  {detail.candidate.source && (
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Origen</dt>
                      <dd className="text-foreground">{detail.candidate.source}</dd>
                    </div>
                  )}
                  {detail.candidate.contact.email && (
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Email</dt>
                      <dd className="truncate text-foreground">{detail.candidate.contact.email}</dd>
                    </div>
                  )}
                  {detail.candidate.contact.phone && (
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Teléfono</dt>
                      <dd className="text-foreground">{detail.candidate.contact.phone}</dd>
                    </div>
                  )}
                  <div className="my-1 h-px bg-border-default" />
                  <div className="flex items-center justify-between">
                    <dt className="text-neutral-500">Aplicó</dt>
                    <dd className="text-foreground">{formatDate(detail.appliedAt)}</dd>
                  </div>
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
                <p className="text-sm text-neutral-500">Aplicó el {formatDate(detail.appliedAt)}.</p>
              </TabsContent>

              {COMING_SOON_TABS.map((t) => (
                <TabsContent key={t} value={t}>
                  <p className="text-sm text-neutral-500">Disponible próximamente.</p>
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </div>
      )}
    </Sheet>
  );
}
