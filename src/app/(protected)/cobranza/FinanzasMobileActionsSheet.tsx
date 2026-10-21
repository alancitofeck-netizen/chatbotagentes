"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/toast/toast";
import { markMovimientoPaidAction, markMovimientoPendingAction, deleteMovimientoAction } from "@/lib/finanzas/actions";
import { buildRecordatorioMessage } from "@/lib/finanzas/reminders";
import type { FinanzasMovimiento } from "@/lib/finanzas/queries";
import { CATEGORY_ICON, CATEGORY_COLOR } from "./FinanzasMobileItem";

function fmtOriginal(m: FinanzasMovimiento) {
  return `${Math.round(m.monto).toLocaleString("es-AR")} ${m.moneda}`;
}

export function FinanzasMobileActionsSheet({
  item,
  onClose,
  onEdit,
  onChanged,
}: {
  item: FinanzasMovimiento;
  onClose: () => void;
  onEdit: (m: FinanzasMovimiento) => void;
  onChanged: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const verb = item.tipo === "in" ? "cobrado" : "pagado";

  async function handleDone() {
    setBusy(true);
    try {
      await markMovimientoPaidAction(item.id);
      toast.success(item.tipo === "in" ? "Cobro registrado ✓" : "Gasto pagado ✓");
      onChanged();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar.");
    } finally {
      setBusy(false);
    }
  }
  async function handleUndo() {
    setBusy(true);
    try {
      await markMovimientoPendingAction(item.id);
      toast.success("Vuelto a pendiente");
      onChanged();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo deshacer.");
    } finally {
      setBusy(false);
    }
  }
  async function handleDelete() {
    setBusy(true);
    try {
      await deleteMovimientoAction(item.id);
      toast.success("Borrado");
      onChanged();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }
  function handleWhatsapp() {
    const msg = buildRecordatorioMessage(item);
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  }

  return (
    <>
      <Sheet open onClose={onClose} title="Movimiento">
        <div className="flex flex-col gap-2 p-5">
          <div className="mb-2 flex items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl text-[20px]" style={{ background: `${CATEGORY_COLOR[item.categoria]}1f` }}>
              {CATEGORY_ICON[item.categoria] ?? "💰"}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold text-foreground">{item.descripcion}</div>
              <div className="text-[13px] text-neutral-500">
                {fmtOriginal(item)} · {new Date(item.fechaVencimiento).toLocaleDateString("es-AR")}
              </div>
            </div>
          </div>

          {item.estado === "pagado" ? (
            <button type="button" disabled={busy} onClick={handleUndo} className="rounded-2xl border border-border-default bg-surface-2 p-3.5 text-left text-[15px] font-medium text-foreground disabled:opacity-60">
              ↩ Marcar como pendiente
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={handleDone} className="rounded-2xl border border-border-default bg-surface-2 p-3.5 text-left text-[15px] font-medium text-success-strong disabled:opacity-60">
              ✓ Marcar como {verb}
            </button>
          )}

          {item.tipo === "in" && item.estado === "pendiente" && (
            <button type="button" onClick={handleWhatsapp} className="rounded-2xl border border-border-default bg-surface-2 p-3.5 text-left text-[15px] font-medium text-foreground">
              💬 Enviar recordatorio por WhatsApp
            </button>
          )}

          <button type="button" onClick={() => onEdit(item)} className="rounded-2xl border border-border-default bg-surface-2 p-3.5 text-left text-[15px] font-medium text-foreground">
            ✏️ Editar
          </button>

          <button type="button" onClick={() => setConfirmOpen(true)} className="rounded-2xl border border-border-default bg-surface-2 p-3.5 text-left text-[15px] font-medium text-error-strong">
            🗑 Borrar
          </button>
        </div>
      </Sheet>

      <ConfirmDialog
        open={confirmOpen}
        title="¿Borrar este movimiento?"
        description={`"${item.descripcion}" no se puede recuperar.`}
        confirmLabel="Borrar"
        danger
        isLoading={busy}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </>
  );
}
