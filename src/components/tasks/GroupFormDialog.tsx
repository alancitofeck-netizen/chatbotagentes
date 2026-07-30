"use client";

import { useState, useTransition } from "react";
import { ImagePlus, X } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { cn } from "@/lib/utils/cn";
import type { GroupColor, TaskGroup } from "@/lib/tasks/groups/queries";
import { createTaskGroup, updateTaskGroup } from "@/lib/tasks/groups/actions";
import { GROUP_COLOR_KEYS, GROUP_COLOR_META, GROUP_ICON_PRESETS } from "./groupColorMeta";

/** Create/edit a Grupo de Tareas — same Sheet-based single-form-for-both-modes
 * convention as TaskFormSheet. Cover upload has no crop step (unlike avatars/
 * mini-app logos) — a banner doesn't need face-centering, uploaded as-is. */
export function GroupFormDialog({
  current,
  onClose,
  onSaved,
}: {
  current: TaskGroup | null;
  onClose: () => void;
  onSaved: (groupId: string) => void;
}) {
  const isEdit = Boolean(current);
  const [name, setName] = useState(current?.name ?? "");
  const [description, setDescription] = useState(current?.description ?? "");
  const [icon, setIcon] = useState(current?.icon ?? "📁");
  const [color, setColor] = useState<GroupColor>(current?.color ?? "accent");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(current?.coverImageUrl ?? null);
  const [isPending, startTransition] = useTransition();

  function handleCoverChange(file: File | null) {
    setCoverFile(file);
    setCoverPreview(file ? URL.createObjectURL(file) : (current?.coverImageUrl ?? null));
  }

  async function uploadCover(groupId: string): Promise<string | null> {
    if (!coverFile) return current?.coverImageUrl ?? null;
    // Uploaded through /api/tasks/groups/[groupId]/cover instead of calling
    // Storage directly from the browser — this project's Storage service
    // doesn't verify its own current JWT signing key, so a direct
    // supabase.storage.from(...).upload() always authenticates as Postgres
    // role `anon` and gets rejected by RLS (see
    // supabase/migrations/0070_task_group_covers_final.sql).
    const body = new FormData();
    body.append("file", coverFile);
    const res = await fetch(`/api/tasks/groups/${groupId}/cover`, { method: "POST", body });
    if (!res.ok) {
      toast.error("No se pudo subir la portada.");
      return current?.coverImageUrl ?? null;
    }
    const { url } = (await res.json()) as { url: string };
    return url;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    startTransition(async () => {
      try {
        if (isEdit && current) {
          const coverImageUrl = await uploadCover(current.id);
          await updateTaskGroup(current.id, { name, description, icon, color, coverImageUrl });
          toast.success("Grupo actualizado.");
          onSaved(current.id);
        } else {
          const { id } = await createTaskGroup({ name, description, icon, color, coverImageUrl: null });
          if (coverFile) {
            const coverImageUrl = await uploadCover(id);
            await updateTaskGroup(id, { name, description, icon, color, coverImageUrl });
          }
          toast.success("Grupo creado.");
          onSaved(id);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar el grupo.");
      }
    });
  }

  return (
    <Sheet open onClose={onClose} title={isEdit ? "Configurar grupo" : "Nuevo grupo de tareas"}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Portada (opcional)</span>
          {coverPreview ? (
            <div className="relative h-28 w-full overflow-hidden rounded-lg border border-border-default">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview or remote Storage URL, dimensions dynamic */}
              <img src={coverPreview} alt="Portada" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => handleCoverChange(null)}
                aria-label="Quitar portada"
                className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-neutral-950/60 text-white hover:bg-neutral-950/80"
              >
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <label className="flex h-20 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong text-sm text-neutral-500 hover:border-accent-500 hover:text-accent-600">
              <ImagePlus size={16} aria-hidden="true" />
              Subir portada
              <input type="file" accept="image/*" className="hidden" onChange={(e) => handleCoverChange(e.target.files?.[0] ?? null)} />
            </label>
          )}
        </div>

        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground" htmlFor="group-description">
            Descripción
          </label>
          <textarea
            id="group-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="resize-none rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Ícono</span>
          <div className="flex flex-wrap gap-1.5">
            {GROUP_ICON_PRESETS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setIcon(e)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-md border text-[15px]",
                  icon === e ? "border-accent-500 bg-accent-100" : "border-border-default hover:bg-surface-2",
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Color</span>
          <div className="flex gap-2">
            {GROUP_COLOR_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setColor(key)}
                title={GROUP_COLOR_META[key].label}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border-2",
                  color === key ? "border-foreground" : "border-transparent",
                )}
              >
                <span className={cn("size-5 rounded-full", GROUP_COLOR_META[key].dot)} />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            {isEdit ? "Guardar cambios" : "Crear grupo"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
