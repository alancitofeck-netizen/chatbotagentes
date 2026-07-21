"use client";

import { useMemo, useState, useTransition } from "react";
import { Pencil, Plus, Search, Tag as TagIcon, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/toast/toast";
import { cn } from "@/lib/utils/cn";
import type { WorkspaceTagWithUsage } from "@/lib/inbox/queries";
import { createWorkspaceTag, deleteWorkspaceTag, renameWorkspaceTag } from "@/lib/inbox/actions";

const COLOR_OPTIONS: BadgeVariant[] = ["neutral", "accent", "success", "warning", "error"];
const COLOR_LABELS: Record<BadgeVariant, string> = {
  neutral: "Gris",
  accent: "Azul",
  success: "Verde",
  warning: "Amarillo",
  error: "Rojo",
};

function ColorPicker({ value, onChange }: { value: BadgeVariant; onChange: (v: BadgeVariant) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_OPTIONS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onChange(color)}
          aria-pressed={value === color}
          title={COLOR_LABELS[color]}
          className={cn(
            "rounded-full transition-shadow duration-[var(--duration-fast)]",
            value === color ? "ring-2 ring-accent-500 ring-offset-2" : "",
          )}
        >
          <Badge variant={color}>{COLOR_LABELS[color]}</Badge>
        </button>
      ))}
    </div>
  );
}

/** Gestión real de etiquetas — hasta ahora las etiquetas solo podían
 * asignarse/desasignarse a un contacto (toggleContactTag), nunca crearse,
 * renombrarse ni eliminarse desde una pantalla dedicada. Reusa
 * createWorkspaceTag (existía sin ningún caller en la UI) y agrega
 * renameWorkspaceTag/deleteWorkspaceTag (src/lib/inbox/actions.ts). */
export function TagsShell({
  initialTags,
  canDelete,
}: {
  initialTags: WorkspaceTagWithUsage[];
  canDelete: boolean;
}) {
  const [tags, setTags] = useState(initialTags);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState<BadgeVariant>("neutral");
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<BadgeVariant>("neutral");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(
    () => tags.filter((t) => t.name.toLowerCase().includes(search.trim().toLowerCase())),
    [tags, search],
  );

  function handleCreate() {
    if (!newName.trim()) {
      toast.error("El nombre de la etiqueta es obligatorio.");
      return;
    }
    startTransition(async () => {
      try {
        const created = await createWorkspaceTag(newName, newColor);
        setTags((prev) => [...prev, { ...created, contactCount: 0 }].sort((a, b) => a.name.localeCompare(b.name)));
        setNewName("");
        setNewColor("neutral");
        toast.success("Etiqueta creada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear la etiqueta.");
      }
    });
  }

  function startEdit(tag: WorkspaceTagWithUsage) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color as BadgeVariant);
  }

  function handleSaveEdit(tagId: string) {
    if (!editName.trim()) return;
    startTransition(async () => {
      try {
        await renameWorkspaceTag(tagId, editName, editColor);
        setTags((prev) =>
          prev
            .map((t) => (t.id === tagId ? { ...t, name: editName.trim(), color: editColor } : t))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        setEditingId(null);
        toast.success("Etiqueta actualizada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar la etiqueta.");
      }
    });
  }

  function handleDelete(tag: WorkspaceTagWithUsage) {
    const warning =
      tag.contactCount > 0
        ? `¿Eliminar "${tag.name}"? Se quitará de ${tag.contactCount} contacto(s). Esta acción no se puede deshacer.`
        : `¿Eliminar la etiqueta "${tag.name}"?`;
    if (!window.confirm(warning)) return;
    startTransition(async () => {
      try {
        await deleteWorkspaceTag(tag.id);
        setTags((prev) => prev.filter((t) => t.id !== tag.id));
        toast.success("Etiqueta eliminada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo eliminar la etiqueta.");
      }
    });
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-foreground">Etiquetas</h1>
        <p className="text-sm text-neutral-500">
          Organizá contactos y conversaciones con etiquetas compartidas entre Inbox y CRM.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-border-default bg-surface-1 p-4">
        <p className="text-sm font-medium text-foreground">Nueva etiqueta</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Input
            label="Nombre"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ej. VIP, Urgente, Reclamo"
            containerClassName="flex-1"
          />
          <Button onClick={handleCreate} loading={isPending}>
            <Plus size={15} aria-hidden="true" />
            Crear etiqueta
          </Button>
        </div>
        <ColorPicker value={newColor} onChange={setNewColor} />
      </div>

      <div className="relative max-w-xs">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar etiqueta…"
          className="w-full rounded-sm border border-border-strong bg-surface-1 py-2 pl-9 pr-3 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={TagIcon}
          title={tags.length === 0 ? "Todavía no hay etiquetas" : "Sin resultados"}
          description={
            tags.length === 0
              ? "Creá la primera etiqueta para empezar a organizar contactos."
              : "Probá con otro término de búsqueda."
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((tag) => (
            <li key={tag.id} className="rounded-lg border border-border-default bg-surface-1 p-3">
              {editingId === tag.id ? (
                <div className="flex flex-col gap-3">
                  <Input label="Nombre" value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <ColorPicker value={editColor} onChange={setEditColor} />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleSaveEdit(tag.id)} loading={isPending}>
                      Guardar
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Badge variant={tag.color as BadgeVariant}>{tag.name}</Badge>
                  <span className="text-sm text-neutral-500">
                    {tag.contactCount} {tag.contactCount === 1 ? "contacto" : "contactos"}
                  </span>
                  <div className="ml-auto flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => startEdit(tag)}
                      aria-label="Renombrar etiqueta"
                      className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2 hover:text-foreground"
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(tag)}
                        aria-label="Eliminar etiqueta"
                        className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
