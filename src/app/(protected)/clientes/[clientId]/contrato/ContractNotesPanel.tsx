"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { getClientNotesAction, addClientNoteAction, updateClientNoteAction, deleteClientNoteAction } from "@/lib/clients/actions";
import type { ClientNote } from "@/lib/clients/queries";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

export function ContractNotesPanel({
  clientId,
  initialNotes,
  nameById,
  title = "Notas internas",
}: {
  clientId: string;
  initialNotes: ClientNote[];
  nameById: Map<string, string>;
  title?: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [newBody, setNewBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [isPending, startTransition] = useTransition();

  async function refetch() {
    setNotes(await getClientNotesAction(clientId));
  }

  function handleAdd() {
    if (!newBody.trim()) return;
    startTransition(async () => {
      try {
        await addClientNoteAction(clientId, newBody);
        setNewBody("");
        await refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo agregar la nota.");
      }
    });
  }

  function handleSaveEdit(noteId: string) {
    startTransition(async () => {
      try {
        await updateClientNoteAction(noteId, clientId, editingBody);
        setEditingId(null);
        await refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo editar la nota.");
      }
    });
  }

  function handleDelete(noteId: string) {
    if (!window.confirm("¿Eliminar esta nota?")) return;
    startTransition(async () => {
      await deleteClientNoteAction(noteId, clientId);
      await refetch();
    });
  }

  return (
    <Card>
      <CardHeader title={title} />
      <div className="flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <textarea
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            rows={2}
            placeholder="Agregar una nota interna del equipo…"
            className="flex-1 rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
          <Button size="sm" onClick={handleAdd} loading={isPending}>
            Agregar
          </Button>
        </div>

        {notes.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin notas internas todavía.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.map((n) => (
              <li key={n.id} className="rounded-md bg-surface-2 p-3 text-sm">
                {editingId === n.id ? (
                  <div className="flex flex-col gap-2">
                    <textarea
                      value={editingBody}
                      onChange={(e) => setEditingBody(e.target.value)}
                      rows={2}
                      className="rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
                    />
                    <div className="flex gap-2">
                      <button type="button" onClick={() => handleSaveEdit(n.id)} className="flex items-center gap-1 text-xs font-medium text-accent-600 hover:underline">
                        <Check size={12} aria-hidden="true" /> Guardar
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="flex items-center gap-1 text-xs text-neutral-500 hover:underline">
                        <X size={12} aria-hidden="true" /> Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-foreground">{n.body}</p>
                    <div className="mt-1.5 flex items-center justify-between">
                      <p className="text-xs text-neutral-500">
                        Por {n.authorId ? (nameById.get(n.authorId) ?? "—") : "—"} · {formatDate(n.createdAt)}
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(n.id);
                            setEditingBody(n.body);
                          }}
                          className="text-neutral-400 hover:text-foreground"
                          aria-label="Editar nota"
                        >
                          <Pencil size={13} aria-hidden="true" />
                        </button>
                        <button type="button" onClick={() => handleDelete(n.id)} className="text-neutral-400 hover:text-error-strong" aria-label="Eliminar nota">
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
