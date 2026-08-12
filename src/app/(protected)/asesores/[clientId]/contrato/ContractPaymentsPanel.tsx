"use client";

import { useState, useTransition } from "react";
import { Check, Trash2, CalendarRange, Plus, Paperclip } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/toast/toast";
import { uploadDocumentFile } from "@/lib/documents/uploadClient";
import { recordUploadedDocument, getDownloadUrl } from "@/lib/documents/actions";
import {
  getClientContractPaymentsAction,
  generateClientContractPaymentScheduleAction,
  addClientContractPaymentAction,
  updateClientContractPaymentStatusAction,
  attachClientContractPaymentDocumentAction,
  deleteClientContractPaymentAction,
} from "@/lib/clients/actions";
import type { ClientContractPayment } from "@/lib/clients/queries";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

/** "Vencido" se deriva en vivo (fecha pasada + pendiente), nunca guardado
 * — mismo criterio que deriveCollectionBucket (policies/PolicyDetailSheet),
 * versión simplificada porque acá solo hay 2 estados guardados. */
function badgeFor(p: ClientContractPayment): { label: string; variant: "success" | "warning" | "error" } {
  if (p.status === "pagado") return { label: "Pagado", variant: "success" };
  if (new Date(p.dueDate) < new Date(new Date().toDateString())) return { label: "Vencido", variant: "error" };
  return { label: "Pendiente", variant: "warning" };
}

export function ContractPaymentsPanel({ contractId, clientId, currency, initialPayments }: { contractId: string; clientId: string; currency: string; initialPayments: ClientContractPayment[] }) {
  const [payments, setPayments] = useState(initialPayments);
  const [newDate, setNewDate] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [isPending, startTransition] = useTransition();
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  async function refetch() {
    setPayments(await getClientContractPaymentsAction(contractId));
  }

  function handleGenerate() {
    startTransition(async () => {
      try {
        const rows = await generateClientContractPaymentScheduleAction(contractId);
        setPayments(rows);
        toast.success("Cronograma generado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo generar el cronograma.");
      }
    });
  }

  function handleAdd() {
    if (!newDate || !newAmount) {
      toast.error("Completá fecha y monto.");
      return;
    }
    startTransition(async () => {
      try {
        await addClientContractPaymentAction(contractId, clientId, { dueDate: newDate, amount: Number(newAmount), currency });
        setNewDate("");
        setNewAmount("");
        await refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo agregar el pago.");
      }
    });
  }

  function handleToggle(p: ClientContractPayment) {
    startTransition(async () => {
      try {
        await updateClientContractPaymentStatusAction(p.id, clientId, p.status === "pagado" ? "pendiente" : "pagado");
        await refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar el pago.");
      }
    });
  }

  function handleDelete(paymentId: string) {
    startTransition(async () => {
      await deleteClientContractPaymentAction(paymentId, clientId);
      await refetch();
    });
  }

  async function handleAttach(paymentId: string, file: File) {
    setUploadingFor(paymentId);
    try {
      const storageId = crypto.randomUUID();
      const storagePath = `${clientId}/${storageId}/${file.name}`;
      const uploaded = await uploadDocumentFile(storagePath, file);
      if (!uploaded) throw new Error("No se pudo subir el archivo.");
      const { id: documentId } = await recordUploadedDocument({
        name: file.name,
        folderId: null,
        mimeType: file.type,
        sizeBytes: file.size,
        storagePath,
        relatedType: "client",
        relatedId: clientId,
        docCategory: "facturacion",
      });
      await attachClientContractPaymentDocumentAction(paymentId, clientId, documentId);
      toast.success("Comprobante adjuntado.");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo adjuntar el comprobante.");
    } finally {
      setUploadingFor(null);
    }
  }

  async function handleViewComprobante(documentId: string) {
    const url = await getDownloadUrl(documentId);
    if (url) window.open(url, "_blank");
    else toast.error("No se pudo abrir el comprobante.");
  }

  return (
    <Card>
      <CardHeader title="Pagos y facturación" />
      <div className="flex flex-col gap-3">
        {payments.length === 0 && (
          <Button size="sm" variant="secondary" onClick={handleGenerate} loading={isPending}>
            <CalendarRange className="size-4" aria-hidden="true" />
            Generar cronograma mensual
          </Button>
        )}

        <div className="flex items-end gap-2">
          <Input label="Vencimiento" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} containerClassName="flex-1" />
          <Input label="Monto" type="number" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} containerClassName="w-28" />
          <Button size="sm" onClick={handleAdd} loading={isPending}>
            <Plus className="size-4" aria-hidden="true" />
          </Button>
        </div>

        {payments.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin pagos cargados.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border-default text-xs text-neutral-500">
                <th className="py-2 font-medium">#</th>
                <th className="py-2 font-medium">Fecha</th>
                <th className="py-2 font-medium">Descripción</th>
                <th className="py-2 font-medium">Monto</th>
                <th className="py-2 font-medium">Estado</th>
                <th className="py-2 font-medium">Comprobante</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => {
                const badge = badgeFor(p);
                return (
                  <tr key={p.id} className="border-b border-border-default last:border-0">
                    <td className="py-2 text-neutral-500">{i + 1}</td>
                    <td className="py-2 text-neutral-500">{formatDate(p.dueDate)}</td>
                    <td className="py-2 text-foreground">Pago {i + 1}</td>
                    <td className="py-2 text-foreground">
                      {p.currency} {p.amount.toLocaleString("es-MX")}
                    </td>
                    <td className="py-2">
                      <button
                        type="button"
                        onClick={() => handleToggle(p)}
                        className="inline-flex items-center gap-1.5"
                        aria-label={p.status === "pagado" ? "Marcar como pendiente" : "Marcar como pagado"}
                      >
                        <span className={`flex size-5 items-center justify-center rounded-full border ${p.status === "pagado" ? "border-success-strong bg-success-bg text-success-strong" : "border-border-strong text-neutral-400"}`}>
                          <Check size={12} aria-hidden="true" />
                        </span>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </button>
                    </td>
                    <td className="py-2">
                      {p.documentId ? (
                        <button type="button" onClick={() => handleViewComprobante(p.documentId!)} className="text-accent-600 hover:underline">
                          Ver
                        </button>
                      ) : (
                        <label className="flex cursor-pointer items-center gap-1 text-xs text-neutral-500 hover:text-accent-600">
                          <Paperclip size={12} aria-hidden="true" />
                          {uploadingFor === p.id ? "Subiendo…" : "Adjuntar"}
                          <input
                            type="file"
                            className="hidden"
                            disabled={uploadingFor === p.id}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleAttach(p.id, file);
                            }}
                          />
                        </label>
                      )}
                    </td>
                    <td className="py-2">
                      <button type="button" onClick={() => handleDelete(p.id)} className="text-neutral-400 hover:text-error-strong" aria-label="Eliminar pago">
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}
