"use client";

import { useState, useTransition } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/toast/toast";
import type { ConversationDetail, WorkspaceMemberOption, WorkspaceTag } from "@/lib/inbox/queries";
import { updateConversationStatus, assignConversation, addConversationNote, toggleContactTag } from "@/lib/inbox/actions";
import { tagBadgeVariant } from "./tagColor";

const STATUS_OPTIONS = [
  { value: "open", label: "Abierta" },
  { value: "pending_human", label: "Esperando" },
  { value: "closed", label: "Cerrada" },
];

const COMING_SOON_TABS = ["archivos"];

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ContactInfoPanel({
  detail,
  loading,
  members,
  tags,
  onChanged,
}: {
  detail: ConversationDetail | null;
  loading: boolean;
  members: WorkspaceMemberOption[];
  tags: WorkspaceTag[];
  onChanged: () => void;
}) {
  const [tab, setTab] = useState("resumen");
  const [noteBody, setNoteBody] = useState("");
  const [isPending, startTransition] = useTransition();

  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-5">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!detail) {
    return <div className="p-5 text-sm text-neutral-500">Seleccioná una conversación para ver sus detalles.</div>;
  }

  function handleStatusChange(status: string) {
    if (!detail) return;
    startTransition(async () => {
      await updateConversationStatus(detail.id, status);
      onChanged();
      toast.success("Estado actualizado.");
    });
  }

  function handleAssign(memberId: string) {
    if (!detail) return;
    startTransition(async () => {
      await assignConversation(detail.id, memberId || null);
      onChanged();
      toast.success("Conversación asignada.");
    });
  }

  function handleAddNote() {
    if (!detail || !noteBody.trim()) return;
    const body = noteBody.trim();
    setNoteBody("");
    startTransition(async () => {
      await addConversationNote(detail.id, body);
      onChanged();
      toast.success("Nota agregada.");
    });
  }

  function handleToggleTag(tagId: string, enabled: boolean) {
    if (!detail) return;
    startTransition(async () => {
      await toggleContactTag(detail.contact.id, tagId, enabled);
      onChanged();
    });
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="px-5 pt-4 pb-5">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="notas">Notas</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
            {COMING_SOON_TABS.map((t) => (
              <TabsTrigger key={t} value={t} disabled>
                {t[0].toUpperCase() + t.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="py-4">
            <TabsContent value="resumen">
              <div className="flex flex-col gap-5">
                <dl className="flex flex-col gap-3 text-sm">
                  {detail.contact.email && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-neutral-500">Email</dt>
                      <dd className="truncate text-foreground">{detail.contact.email}</dd>
                    </div>
                  )}
                  {detail.contact.phone && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-neutral-500">Teléfono</dt>
                      <dd className="text-foreground">{detail.contact.phone}</dd>
                    </div>
                  )}
                  {detail.contact.company && (
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-neutral-500">Empresa</dt>
                      <dd className="text-foreground">{detail.contact.company}</dd>
                    </div>
                  )}
                </dl>

                <Select
                  label="Estado"
                  value={detail.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  disabled={isPending}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Asignado a"
                  value={detail.assignedMemberId ?? ""}
                  onChange={(e) => handleAssign(e.target.value)}
                  disabled={isPending}
                >
                  <option value="">Sin asignar</option>
                  {members.map((m) => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.fullName}
                    </option>
                  ))}
                </Select>

                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">Etiquetas</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.length === 0 && (
                      <p className="text-xs text-neutral-500">No hay etiquetas en este workspace.</p>
                    )}
                    {tags.map((t) => {
                      const active = detail.tags.some((dt) => dt.id === t.id);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          disabled={isPending}
                          onClick={() => handleToggleTag(t.id, !active)}
                          className="disabled:opacity-50"
                        >
                          <Badge variant={active ? tagBadgeVariant(t.color) : "neutral"} className={active ? "" : "opacity-60"}>
                            {t.name}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </div>
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

            <TabsContent value="historial">
              <p className="text-sm text-neutral-500">{detail.messages.length} mensajes en esta conversación.</p>
            </TabsContent>

            {COMING_SOON_TABS.map((t) => (
              <TabsContent key={t} value={t}>
                <p className="text-sm text-neutral-500">Disponible próximamente (requiere Supabase Storage).</p>
              </TabsContent>
            ))}
          </div>
        </Tabs>
      </div>
    </div>
  );
}
