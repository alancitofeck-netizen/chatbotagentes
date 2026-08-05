"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { toast } from "@/components/toast/toast";
import type { AdvisorySessionListItem, AdvisoryStatus } from "@/lib/advisorySessions/queries";
import { createAdvisorySessionAction, deleteAdvisorySessionAction } from "@/lib/advisorySessions/actions";
import { ADVISORY_STEPS } from "@/lib/advisorySessions/constants";

const STATUS_VARIANT: Record<AdvisoryStatus, "success" | "warning" | "neutral"> = {
  en_progreso: "warning",
  completada: "success",
  archivada: "neutral",
};
const STATUS_LABEL: Record<AdvisoryStatus, string> = { en_progreso: "En progreso", completada: "Completada", archivada: "Archivada" };
const STEP_LABEL = new Map(ADVISORY_STEPS.map((s) => [s.key, s.label]));

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function AdvisorySessionsListShell({ initialSessions }: { initialSessions: AdvisorySessionListItem[] }) {
  const router = useRouter();
  const [sessions, setSessions] = useState(initialSessions);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleCreate() {
    setIsPending(true);
    try {
      const { id } = await createAdvisorySessionAction({ contactName: newName, contactPhone: newPhone });
      router.push(`/asesoria-guiada/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la asesoría.");
      setIsPending(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("¿Eliminar esta asesoría? Esta acción no se puede deshacer.")) return;
    await deleteAdvisorySessionAction(id);
    setSessions((prev) => prev.filter((s) => s.id !== id));
    toast.success("Asesoría eliminada.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" aria-hidden="true" />
          Nueva asesoría
        </Button>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Todavía no iniciaste ninguna asesoría"
          description="Arrancá una mientras estás en la reunión con tu cliente."
          action={
            <Button onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Nueva asesoría
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-border-default text-xs text-neutral-500">
                <th className="px-3 py-2.5 font-medium">Cliente</th>
                <th className="px-3 py-2.5 font-medium">Estado</th>
                <th className="px-3 py-2.5 font-medium">Paso actual</th>
                <th className="px-3 py-2.5 font-medium">Última actividad</th>
                <th className="px-3 py-2.5 font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-border-default last:border-0 hover:bg-surface-2">
                  <td className="px-3 py-2.5">
                    <button type="button" onClick={() => router.push(`/asesoria-guiada/${s.id}`)} className="text-left font-medium text-foreground hover:text-accent-700">
                      {s.contactName ?? "Sin cliente vinculado"}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={STATUS_VARIANT[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                  </td>
                  <td className="px-3 py-2.5 text-neutral-600">{STEP_LABEL.get(s.currentStep) ?? s.currentStep}</td>
                  <td className="px-3 py-2.5 text-neutral-600">{formatDateTime(s.updatedAt)}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="secondary" onClick={() => router.push(`/asesoria-guiada/${s.id}`)}>
                        Continuar
                      </Button>
                      <button
                        type="button"
                        onClick={() => handleDelete(s.id)}
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

      <Sheet open={creating} onClose={() => setCreating(false)} title="Nueva asesoría">
        <div className="flex flex-col gap-4 p-5">
          <p className="text-sm text-neutral-500">Ingresá los datos del cliente para empezar — podés completarlos o corregirlos en el paso Perfil.</p>
          <Input label="Nombre del cliente" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Input label="Teléfono" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
          <Button onClick={handleCreate} loading={isPending}>
            Empezar asesoría
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
