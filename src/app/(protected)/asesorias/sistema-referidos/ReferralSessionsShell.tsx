"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift, Loader2, Play, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/toast/toast";
import { createReferralSessionAction, deleteAsesoriaAction } from "@/lib/asesorias/actions";
import type { ReferralSessionItem } from "@/lib/asesorias/referralSystem";
import { formatRelativeTime } from "@/lib/utils/format";

const STATUS: Record<ReferralSessionItem["status"], { label: string; variant: BadgeVariant }> = {
  no_iniciada: { label: "Sin empezar", variant: "neutral" },
  en_progreso: { label: "En progreso", variant: "warning" },
  finalizada: { label: "Finalizada", variant: "success" },
};

/** Sesiones del Sistema de Referidos: una por prospecto. Cada sesión abre el HTML del usuario a pantalla
 * completa (/asesorias/[id]); lo que se carga ahí (y los referidos) se ve igual en todas las cuentas del
 * grupo. */
export function ReferralSessionsShell({ sessions, partnerCount }: { sessions: ReferralSessionItem[]; partnerCount: number }) {
  const router = useRouter();
  const [creating, startCreating] = useTransition();
  const [toDelete, setToDelete] = useState<ReferralSessionItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  function handleCreate() {
    startCreating(async () => {
      try {
        const { id } = await createReferralSessionAction();
        router.push(`/asesorias/${id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear la sesión.");
      }
    });
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteAsesoriaAction(toDelete.id);
      toast.success("Sesión eliminada en las dos cuentas.");
      setToDelete(null);
      router.refresh();
    } catch {
      toast.error("No se pudo eliminar la sesión.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-default bg-surface-1 p-4">
        <p className="max-w-xl text-sm text-neutral-600">
          Cada sesión es el cierre con referidos de un prospecto.{" "}
          {partnerCount > 1 ? "Se comparte con la otra cuenta: las sesiones y los referidos se ven igual en las dos." : null}
        </p>
        <Button onClick={handleCreate} disabled={creating}>
          {creating ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
          Nueva sesión
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border-default bg-surface-2 p-10 text-center">
          <Gift className="size-7 text-accent-600" aria-hidden="true" />
          <p className="font-semibold text-foreground">Todavía no hay sesiones</p>
          <p className="text-sm text-neutral-500">Tocá &quot;Nueva sesión&quot; al cerrar con un prospecto para pedirle referidos.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => {
            const status = STATUS[s.status];
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border-default bg-surface-1 p-4">
                <div className="min-w-0 flex-1">
                  <button type="button" onClick={() => router.push(`/asesorias/${s.id}`)} className="truncate text-left text-base font-semibold text-foreground hover:text-accent-700">
                    {s.name}
                  </button>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-neutral-500">
                    <span>{s.advisor ? `Asesor: ${s.advisor}` : "Sin asesor"}</span>
                    <span className="flex items-center gap-1">
                      <Users className="size-3.5" aria-hidden="true" />
                      {s.referidos} {s.referidos === 1 ? "referido" : "referidos"}
                    </span>
                    <span>{formatRelativeTime(s.updatedAt)}</span>
                  </p>
                </div>
                <Badge variant={status.variant}>{status.label}</Badge>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => router.push(`/asesorias/${s.id}`)}>
                    <Play className="size-4" aria-hidden="true" />
                    Abrir
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setToDelete(s)} aria-label={`Eliminar ${s.name}`}>
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        title="Eliminar sesión"
        description={`Se elimina "${toDelete?.name ?? ""}" y sus referidos en las dos cuentas. No se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
