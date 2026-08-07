"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Presentation, Plus, Trash2, Copy } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { toast } from "@/components/toast/toast";
import type { AsesoriaListItem, AsesoriaStatus } from "@/lib/asesorias/queries";
import { createAsesoriaAction, deleteAsesoriaAction, duplicateAsesoriaAction } from "@/lib/asesorias/actions";

const STATUS_VARIANT: Record<AsesoriaStatus, "success" | "warning" | "neutral"> = {
  no_iniciada: "neutral",
  en_progreso: "warning",
  finalizada: "success",
};
const STATUS_LABEL: Record<AsesoriaStatus, string> = { no_iniciada: "No iniciada", en_progreso: "En progreso", finalizada: "Finalizada" };

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function AsesoriasListShell({ initialAsesorias }: { initialAsesorias: AsesoriaListItem[] }) {
  const router = useRouter();
  const [asesorias, setAsesorias] = useState(initialAsesorias);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleCreate() {
    setIsPending(true);
    try {
      const { id } = await createAsesoriaAction({ contactName: newName, contactPhone: newPhone, contactEmail: newEmail });
      router.push(`/asesorias/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la asesoría.");
      setIsPending(false);
    }
  }

  async function handleDuplicate(id: string) {
    try {
      const { id: newId } = await duplicateAsesoriaAction(id);
      router.push(`/asesorias/${newId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo duplicar la asesoría.");
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("¿Eliminar esta asesoría? Esta acción no se puede deshacer.")) return;
    await deleteAsesoriaAction(id);
    setAsesorias((prev) => prev.filter((a) => a.id !== id));
    toast.success("Asesoría eliminada.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Crear Asesoría
        </Button>
      </div>

      {asesorias.length === 0 ? (
        <EmptyState
          icon={Presentation}
          title="Todavía no creaste ninguna asesoría"
          description="Arrancá una mientras estás en la reunión con tu prospecto."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Crear Asesoría
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-default text-xs text-neutral-500">
                <th className="px-3 py-2.5 font-medium">Cliente</th>
                <th className="px-3 py-2.5 font-medium">Estado</th>
                <th className="px-3 py-2.5 font-medium">Asesor</th>
                <th className="px-3 py-2.5 font-medium">Última actividad</th>
                <th className="px-3 py-2.5 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {asesorias.map((a) => (
                <tr key={a.id} className="border-b border-border-default last:border-0 hover:bg-surface-2">
                  <td className="px-3 py-2.5">
                    <button type="button" onClick={() => router.push(`/asesorias/${a.id}`)} className="text-left font-medium text-foreground hover:text-accent-700">
                      {a.contactName ?? a.name}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-neutral-600">{a.advisorName ?? "—"}</td>
                  <td className="px-3 py-2.5 text-neutral-600">{formatDateTime(a.updatedAt)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => router.push(`/asesorias/${a.id}`)}>
                        {a.status === "no_iniciada" ? "Abrir" : "Continuar"}
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(a.id)}
                        className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-surface-3 hover:text-foreground"
                        aria-label="Duplicar"
                        title="Duplicar"
                      >
                        <Copy size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(a.id)}
                        className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong"
                        aria-label="Eliminar"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} title="Crear Asesoría">
        <div className="flex flex-col gap-4 p-5">
          <p className="text-sm text-neutral-500">Ingresá los datos del prospecto para empezar — es opcional, también podés arrancar sin datos y completarlos adentro.</p>
          <Input label="Nombre del prospecto" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Input label="Teléfono" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          <Input label="Correo (opcional)" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
          <Button onClick={handleCreate} loading={isPending}>
            Crear Asesoría
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
