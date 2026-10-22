"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/toast/toast";
import { cn } from "@/lib/utils/cn";
import { deleteFinanceItemAction, setFinancePaidAction } from "@/lib/finance/actions";
import { FINANCE_CATEGORIES, formatMoney, methodIcon, parseIsoDate, whatsappReminderUrl, type FinanceItem } from "@/lib/finance/model";

const ACTION = "w-full rounded-[14px] border border-border-default bg-surface-2 p-3.5 text-left text-[15px] font-semibold hover:border-accent-500 disabled:opacity-60";

export function FinanceActionsSheet({
  item,
  onClose,
  onChanged,
  onEdit,
  onOpenPolicyDetail,
}: {
  item: FinanceItem | null;
  onClose: () => void;
  onChanged: (message: string) => void;
  onEdit: (item: FinanceItem) => void;
  onOpenPolicyDetail: (paymentId: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function run(fn: () => Promise<void>, message: string) {
    setBusy(true);
    try {
      await fn();
      onChanged(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo completar la acción.");
    } finally {
      setBusy(false);
    }
  }

  if (!item) return null;
  const c = FINANCE_CATEGORIES[item.cat];
  const verb = item.type === "in" ? "cobrado" : "pagado";
  const isPolicy = item.source === "policy";

  return (
    <>
      <Sheet open onClose={onClose} title={item.type === "in" ? "Cobro" : "Gasto"} className="max-w-[420px]">
        <div className="grid gap-2 px-5 pb-6 pt-4">
          <div className="mb-1.5 flex items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-xl text-xl" style={{ background: `${c.color}1f` }} aria-hidden="true">
              {c.icon}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-foreground">{item.title}</div>
              <div className="text-[13px] text-neutral-500">
                {formatMoney(item.amount, item.cur)} · {parseIsoDate(item.date).toLocaleDateString("es-MX")}
                {item.method ? ` · ${methodIcon(item.method)} ${item.method}` : ""}
                {item.party ? ` · ${item.party}` : ""}
              </div>
            </div>
          </div>

          {item.paid ? (
            <button type="button" disabled={busy} className={ACTION} onClick={() => run(() => setFinancePaidAction(item.key, false), "Vuelto a pendiente")}>
              ↩ Marcar como pendiente
            </button>
          ) : (
            <button
              type="button"
              disabled={busy}
              className={cn(ACTION, "text-success")}
              onClick={() => run(() => setFinancePaidAction(item.key, true), item.type === "in" ? "Cobro registrado ✓" : "Gasto pagado ✓")}
            >
              ✓ Marcar como {verb}
              {item.rec && <span className="block text-xs font-normal text-neutral-500">Se crea solo el próximo vencimiento ({item.rec}).</span>}
            </button>
          )}
          {item.type === "in" && !item.paid && (
            <a href={whatsappReminderUrl(item)} target="_blank" rel="noopener noreferrer" className={ACTION}>
              💬 Enviar recordatorio por WhatsApp
            </a>
          )}
          {isPolicy && (
            <button type="button" className={ACTION} onClick={() => onOpenPolicyDetail(item.id)}>
              📄 Ver seguimiento de la póliza
              <span className="block text-xs font-normal text-neutral-500">Historial, recibo, referencia y mensaje con IA.</span>
            </button>
          )}
          <button type="button" className={ACTION} onClick={() => onEdit(item)}>
            ✏️ Editar
          </button>
          <button type="button" disabled={busy} className={cn(ACTION, "text-error")} onClick={() => setConfirmDelete(true)}>
            🗑 {isPolicy ? "Cancelar este cobro" : "Borrar"}
          </button>
        </div>
      </Sheet>
      <ConfirmDialog
        open={confirmDelete}
        danger
        title={isPolicy ? "¿Cancelar este cobro de póliza?" : "¿Borrar este movimiento?"}
        description={isPolicy ? "Deja de aparecer en Finanzas y en los recordatorios. Queda en el historial de la póliza." : "No se puede deshacer."}
        confirmLabel={isPolicy ? "Cancelar cobro" : "Borrar"}
        isLoading={busy}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          run(() => deleteFinanceItemAction(item.key), isPolicy ? "Cobro cancelado" : "Borrado");
        }}
      />
    </>
  );
}
