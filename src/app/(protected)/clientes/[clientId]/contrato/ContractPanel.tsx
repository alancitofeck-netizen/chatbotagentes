"use client";

import { useState, useTransition } from "react";
import { UploadCloud, FileText, RefreshCw } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/toast/toast";
import { uploadDocumentFile } from "@/lib/documents/uploadClient";
import { recordUploadedDocument, getDownloadUrl } from "@/lib/documents/actions";
import { updateContractAction, renewContractAction } from "@/lib/clients/actions";
import type { ClientContract, ClientContractStatus, ClientTimelineEvent } from "@/lib/clients/queries";
import { ClientTimelineList } from "../../ClientTimelineList";

const STATUS_META: Record<ClientContractStatus, { label: string; variant: "success" | "warning" | "error" | "info" | "neutral" }> = {
  borrador: { label: "Borrador", variant: "neutral" },
  activo: { label: "Activo", variant: "success" },
  vencido: { label: "Vencido", variant: "error" },
  renovado: { label: "Renovado", variant: "info" },
  cancelado: { label: "Cancelado", variant: "neutral" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysSince(iso: string, now: number): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 86400000));
}

/** Anillo de progreso circular — SVG simple con stroke-dasharray, misma
 * técnica ya usada en las Mini Apps de diagnóstico (gauge arc), sin
 * dependencias nuevas. */
function ProgressRing({ elapsedDays, totalDays, progressPct }: { elapsedDays: number; totalDays: number; progressPct: number }) {
  const r = 52;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - progressPct / 100);
  return (
    <div className="relative size-[132px] shrink-0">
      <svg width="132" height="132" viewBox="0 0 132 132" className="-rotate-90">
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--border-default)" strokeWidth="10" />
        <circle
          cx="66"
          cy="66"
          r={r}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-foreground">{elapsedDays}</span>
        <span className="text-xs text-neutral-500">de {totalDays} días</span>
      </div>
    </div>
  );
}

export function ContractPanel({ clientId, contracts, timeline, nameById }: { clientId: string; contracts: ClientContract[]; timeline: ClientTimelineEvent[]; nameById: Map<string, string> }) {
  const active = contracts.find((c) => c.status === "activo") ?? contracts[0] ?? null;
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [showRenew, setShowRenew] = useState(false);
  const [now] = useState(() => Date.now());

  const [form, setForm] = useState(() =>
    active
      ? {
          startDate: active.startDate,
          endDate: active.endDate,
          totalValue: active.totalValue?.toString() ?? "",
          monthlyValue: active.monthlyValue?.toString() ?? "",
          amountPaid: active.amountPaid?.toString() ?? "",
          commissionModel: active.commissionModel ?? "",
          status: active.status,
          terms: active.notes ?? "",
        }
      : null,
  );

  const totalDays = active ? Math.max(1, Math.round((new Date(active.endDate).getTime() - new Date(active.startDate).getTime()) / 86400000)) : 0;
  const elapsedDays = active ? daysSince(active.startDate, now) : 0;
  const progressPct = totalDays > 0 ? Math.min(100, Math.round((elapsedDays / totalDays) * 100)) : 0;

  const [renewForm, setRenewForm] = useState({ startDate: todayIso(), endDate: todayIso(), totalValue: "", monthlyValue: "", commissionModel: "" });

  function handleSave() {
    if (!active || !form) return;
    startTransition(async () => {
      try {
        await updateContractAction(active.id, {
          startDate: form.startDate,
          endDate: form.endDate,
          totalValue: form.totalValue ? Number(form.totalValue) : null,
          monthlyValue: form.monthlyValue ? Number(form.monthlyValue) : null,
          amountPaid: form.amountPaid ? Number(form.amountPaid) : null,
          commissionModel: form.commissionModel || null,
          status: form.status,
          notes: form.terms || null,
        });
        toast.success("Contrato actualizado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar el contrato.");
      }
    });
  }

  async function handleUpload(file: File) {
    if (!active) return;
    setUploading(true);
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
        docCategory: "contrato",
      });
      await updateContractAction(active.id, { documentId });
      toast.success("Contrato adjunto.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir el archivo.");
    } finally {
      setUploading(false);
    }
  }

  async function handleViewDocument() {
    if (!active?.documentId) return;
    const url = await getDownloadUrl(active.documentId);
    if (url) window.open(url, "_blank");
    else toast.error("No se pudo abrir el contrato.");
  }

  function handleRenew() {
    startTransition(async () => {
      try {
        await renewContractAction(clientId, {
          startDate: renewForm.startDate,
          endDate: renewForm.endDate,
          totalValue: renewForm.totalValue ? Number(renewForm.totalValue) : null,
          monthlyValue: renewForm.monthlyValue ? Number(renewForm.monthlyValue) : null,
          commissionModel: renewForm.commissionModel || null,
        });
        toast.success("Contrato renovado.");
        setShowRenew(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo renovar el contrato.");
      }
    });
  }

  const saldoPendiente = form?.totalValue && form?.amountPaid ? Number(form.totalValue) - Number(form.amountPaid) : null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Contrato activo"
          action={
            active && (
              <Button variant="secondary" onClick={() => setShowRenew((v) => !v)}>
                <RefreshCw size={14} aria-hidden="true" />
                Renovar contrato
              </Button>
            )
          }
        />

        {!active || !form ? (
          <p className="text-sm text-neutral-500">Este cliente todavía no tiene un contrato cargado.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-5 rounded-lg bg-surface-2 p-4">
              <ProgressRing elapsedDays={elapsedDays} totalDays={totalDays} progressPct={progressPct} />
              <div className="flex flex-col gap-1 text-sm">
                <p className="text-neutral-500">
                  Progreso del contrato — <span className="font-medium text-foreground">{progressPct}% completado</span>
                </p>
                <p className="text-neutral-500">
                  Días restantes: <span className="font-medium text-foreground">{Math.max(0, totalDays - elapsedDays)}</span>
                </p>
                <p className="text-neutral-500">
                  {formatDate(active.startDate)} — {formatDate(active.endDate)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input label="Fecha de inicio" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              <Input label="Fecha de finalización" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Valor contratado (USD)" type="number" value={form.totalValue} onChange={(e) => setForm({ ...form, totalValue: e.target.value })} />
              <Input label="Monto pagado (USD)" type="number" value={form.amountPaid} onChange={(e) => setForm({ ...form, amountPaid: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Valor mensual (USD)" type="number" value={form.monthlyValue} onChange={(e) => setForm({ ...form, monthlyValue: e.target.value })} />
              <Select label="Estado" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ClientContractStatus })}>
                {Object.entries(STATUS_META).map(([value, meta]) => (
                  <option key={value} value={value}>
                    {meta.label}
                  </option>
                ))}
              </Select>
            </div>
            {saldoPendiente !== null && (
              <p className="text-sm text-neutral-500">
                Saldo pendiente: <span className="font-medium text-foreground">USD {saldoPendiente.toLocaleString("es-MX")}</span>
              </p>
            )}
            <Input
              label="Modelo de comisión"
              value={form.commissionModel}
              onChange={(e) => setForm({ ...form, commissionModel: e.target.value })}
              placeholder="20% sobre pólizas cerradas"
            />

            <div className="flex items-center gap-2">
              <Badge variant={STATUS_META[active.status].variant}>{STATUS_META[active.status].label}</Badge>
              {active.documentId ? (
                <Button variant="secondary" onClick={handleViewDocument}>
                  <FileText size={14} aria-hidden="true" />
                  Ver contrato
                </Button>
              ) : (
                <label className="flex cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-border-strong px-3 py-1.5 text-[13px] font-medium text-neutral-500 hover:border-accent-500 hover:text-accent-600">
                  <UploadCloud size={14} aria-hidden="true" />
                  {uploading ? "Subiendo…" : "Adjuntar contrato (PDF)"}
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file);
                    }}
                  />
                </label>
              )}
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">Términos y condiciones</span>
              <textarea
                value={form.terms}
                onChange={(e) => setForm({ ...form, terms: e.target.value })}
                rows={4}
                placeholder="Un término por línea — ej. Duración del contrato: 120 días a partir de la fecha de inicio."
                className="rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
              />
            </label>

            <Button onClick={handleSave} loading={isPending} className="mt-2 self-start">
              Guardar cambios
            </Button>
          </div>
        )}
      </Card>

      {showRenew && (
        <Card>
          <CardHeader title="Renovar contrato" />
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Nuevo inicio" type="date" value={renewForm.startDate} onChange={(e) => setRenewForm({ ...renewForm, startDate: e.target.value })} />
              <Input label="Nuevo fin" type="date" value={renewForm.endDate} onChange={(e) => setRenewForm({ ...renewForm, endDate: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Valor total (USD)" type="number" value={renewForm.totalValue} onChange={(e) => setRenewForm({ ...renewForm, totalValue: e.target.value })} />
              <Input label="Valor mensual (USD)" type="number" value={renewForm.monthlyValue} onChange={(e) => setRenewForm({ ...renewForm, monthlyValue: e.target.value })} />
            </div>
            <Input label="Modelo de comisión" value={renewForm.commissionModel} onChange={(e) => setRenewForm({ ...renewForm, commissionModel: e.target.value })} />
            <Button onClick={handleRenew} loading={isPending} className="self-start">
              Confirmar renovación
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Historial del contrato" />
        <ClientTimelineList events={timeline} nameById={nameById} emptyMessage="Todavía no hay actividad registrada para este contrato." />
      </Card>
    </div>
  );
}
