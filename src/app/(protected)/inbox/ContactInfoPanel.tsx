"use client";

import { useState, useTransition } from "react";
import { Mail, Phone, Building2, Briefcase, Tag as TagIcon, StickyNote, Clock, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/toast/toast";
import type { ConversationDetail, WorkspaceMemberOption, WorkspaceTag } from "@/lib/inbox/queries";
import { updateConversationStatus, updateConversationMode, assignConversation, addConversationNote, toggleContactTag } from "@/lib/inbox/actions";
import { tagBadgeVariant } from "./tagColor";

const STATUS_OPTIONS = [
  { value: "open", label: "Abierta" },
  { value: "pending_human", label: "Esperando" },
  { value: "closed", label: "Cerrada" },
];

/** Motor de IA (docs/blueprint/13-agent-engine.md): decide si el Buffer
 * Inteligente invoca al Agent Runtime al hacer flush de esta conversación.
 * `mode` existía en el schema desde el core de Inbox pero nunca se leía ni
 * escribía en ningún lado hasta este pase. */
const MODE_OPTIONS = [
  { value: "human", label: "Humano" },
  { value: "ai", label: "IA" },
  { value: "hybrid", label: "Híbrido (sugerido, no enviado)" },
];

const COMING_SOON_TABS = ["archivos"];

const SOURCE_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  manual: "Alta manual",
};

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
        <Skeleton className="mx-auto size-16 rounded-full" />
        <Skeleton className="mx-auto h-5 w-2/3" />
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

  function handleModeChange(mode: string) {
    if (!detail) return;
    startTransition(async () => {
      await updateConversationMode(detail.id, mode);
      onChanged();
      toast.success("Modo actualizado.");
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

  const lastMessage = detail.messages[detail.messages.length - 1] ?? null;

  // Real activity feed built only from data already fetched — no invented
  // audit trail: every note (with its own timestamp) plus the last message,
  // merged and sorted newest-first.
  const activity = [
    ...detail.notes.map((n) => ({ id: `note-${n.id}`, at: n.createdAt, label: "Nota agregada", detail: n.body })),
    ...(lastMessage
      ? [
          {
            id: "last-message",
            at: lastMessage.createdAt,
            label: lastMessage.direction === "inbound" ? "Mensaje recibido" : "Mensaje enviado",
            detail: lastMessage.body,
          },
        ]
      : []),
  ].sort((a, b) => (a.at > b.at ? -1 : 1));

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface-1">
      <div className="flex flex-col items-center gap-2 border-b border-border-default px-5 pb-5 pt-6">
        <Avatar name={detail.contact.name} src={detail.contact.avatarUrl} size={72} />
        <div className="text-center">
          <p className="text-[15px] font-semibold text-foreground">{detail.contact.name}</p>
          {(detail.contact.jobTitle || detail.contact.company) && (
            <p className="text-[13px] text-neutral-500">
              {[detail.contact.jobTitle, detail.contact.company].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      </div>

      <div className="px-5 pt-4">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="notas">Notas{detail.notes.length > 0 ? ` (${detail.notes.length})` : ""}</TabsTrigger>
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
                <section className="flex flex-col gap-2.5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    Datos de contacto
                  </h3>
                  {detail.contact.email && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Mail size={15} className="shrink-0 text-neutral-400" />
                      <a href={`mailto:${detail.contact.email}`} className="truncate text-foreground hover:text-accent-600 hover:underline">
                        {detail.contact.email}
                      </a>
                    </div>
                  )}
                  {detail.contact.phone && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Phone size={15} className="shrink-0 text-neutral-400" />
                      <a href={`tel:${detail.contact.phone}`} className="text-foreground hover:text-accent-600 hover:underline">
                        {detail.contact.phone}
                      </a>
                    </div>
                  )}
                  {detail.contact.company && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Building2 size={15} className="shrink-0 text-neutral-400" />
                      <span className="text-foreground">{detail.contact.company}</span>
                    </div>
                  )}
                  {detail.contact.jobTitle && (
                    <div className="flex items-center gap-2.5 text-sm">
                      <Briefcase size={15} className="shrink-0 text-neutral-400" />
                      <span className="text-foreground">{detail.contact.jobTitle}</span>
                    </div>
                  )}
                  {!detail.contact.email && !detail.contact.phone && !detail.contact.company && !detail.contact.jobTitle && (
                    <p className="text-[13px] text-neutral-500">Sin datos de contacto adicionales.</p>
                  )}
                </section>

                <section className="flex flex-col gap-2.5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Lead</h3>
                  <div className="flex items-center gap-2.5 text-sm">
                    <span className="text-neutral-500">Origen</span>
                    <Badge variant="accent">
                      {(detail.contact.source && SOURCE_LABELS[detail.contact.source]) || detail.contact.source || "Sin origen"}
                    </Badge>
                  </div>
                </section>

                <section className="flex flex-col gap-2.5">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Conversación</h3>
                  <Select label="Estado" value={detail.status} onChange={(e) => handleStatusChange(e.target.value)} disabled={isPending}>
                    {STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </Select>

                  <Select label="Modo" value={detail.mode} onChange={(e) => handleModeChange(e.target.value)} disabled={isPending}>
                    {MODE_OPTIONS.map((o) => (
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
                </section>

                <section className="flex flex-col gap-2">
                  <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                    <TagIcon size={12} /> Etiquetas
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.length === 0 && <p className="text-xs text-neutral-500">No hay etiquetas en este workspace.</p>}
                    {tags.map((t) => {
                      const active = detail.tags.some((dt) => dt.id === t.id);
                      return (
                        <button key={t.id} type="button" disabled={isPending} onClick={() => handleToggleTag(t.id, !active)} className="disabled:opacity-50">
                          <Badge variant={active ? tagBadgeVariant(t.color) : "neutral"} className={active ? "" : "opacity-60"}>
                            {t.name}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                </section>
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
                    className="flex-1 rounded-full border border-border-strong bg-surface-2 px-3.5 py-2 text-sm outline-none focus:border-accent-500 focus:bg-surface-1 focus:ring-[3px] focus:ring-accent-100"
                  />
                  <Button size="sm" onClick={handleAddNote} loading={isPending}>
                    Agregar
                  </Button>
                </div>
                {detail.notes.length === 0 ? (
                  <p className="text-sm text-neutral-500">Sin notas todavía.</p>
                ) : (
                  <ul className="flex flex-col gap-3 border-l-2 border-border-default pl-3.5">
                    {detail.notes.map((note) => (
                      <li key={note.id} className="relative rounded-md bg-surface-2 p-3">
                        <span className="absolute -left-[19px] top-4 size-2 rounded-full bg-accent-400" aria-hidden="true" />
                        <p className="text-sm text-foreground">{note.body}</p>
                        <p className="mt-1.5 flex items-center gap-1 text-xs text-neutral-500">
                          <StickyNote size={11} /> {formatDate(note.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </TabsContent>

            <TabsContent value="historial">
              {activity.length === 0 ? (
                <p className="text-sm text-neutral-500">Sin actividad todavía.</p>
              ) : (
                <ul className="flex flex-col gap-3 border-l-2 border-border-default pl-3.5">
                  {activity.map((a) => (
                    <li key={a.id} className="relative">
                      <span className="absolute -left-[19px] top-1 size-2 rounded-full bg-neutral-400" aria-hidden="true" />
                      <p className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                        {a.label.startsWith("Mensaje") ? <MessageCircle size={12} /> : <StickyNote size={12} />}
                        {a.label}
                      </p>
                      <p className="truncate text-[13px] text-neutral-500">{a.detail}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-neutral-400">
                        <Clock size={10} /> {formatDate(a.at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
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
