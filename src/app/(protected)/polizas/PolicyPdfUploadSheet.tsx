"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/toast/toast";
import { Sparkles, Trash2, Plus, UploadCloud } from "lucide-react";
import { uploadDocumentFile } from "@/lib/documents/uploadClient";
import { recordUploadedDocument } from "@/lib/documents/actions";
import { extractPolicyFromPdfAction, confirmPolicyFromExtractionAction } from "@/lib/policies/actions";
import type { ExtractedPolicyData, ExtractedCoverage, ExtractedBeneficiary } from "@/lib/policies/pdfExtraction";

type Step = "upload" | "extracting" | "review" | "saving";

const INSURANCE_TYPES = [
  { value: "auto", label: "Auto" },
  { value: "hogar", label: "Hogar" },
  { value: "vida", label: "Vida" },
  { value: "otro", label: "Otro" },
] as const;

export function PolicyPdfUploadSheet({
  workspaceId,
  onClose,
  onSaved,
}: {
  workspaceId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [step, setStep] = useState<Step>("upload");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [data, setData] = useState<ExtractedPolicyData | null>(null);

  function patch(fields: Partial<ExtractedPolicyData>) {
    setData((prev) => (prev ? { ...prev, ...fields } : prev));
  }

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      toast.error("Subí un archivo PDF.");
      return;
    }
    setFileName(file.name);
    setStep("extracting");

    const storageId = crypto.randomUUID();
    const storagePath = `${workspaceId}/${storageId}/${file.name}`;
    const uploaded = await uploadDocumentFile(storagePath, file);
    if (!uploaded) {
      toast.error("No se pudo subir el PDF.");
      setStep("upload");
      return;
    }

    try {
      const { id: newDocumentId } = await recordUploadedDocument({
        name: file.name,
        folderId: null,
        mimeType: file.type,
        sizeBytes: file.size,
        storagePath,
      });
      setDocumentId(newDocumentId);

      const extracted = await extractPolicyFromPdfAction(storagePath);
      if ("error" in extracted) {
        toast.error(extracted.error);
        setStep("upload");
        return;
      }
      setData(extracted);
      setStep("review");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo leer el PDF con IA.");
      setStep("upload");
    }
  }

  function handleConfirm() {
    if (!data || !documentId) return;
    setStep("saving");
    confirmPolicyFromExtractionAction(data, documentId)
      .then(() => {
        toast.success("Póliza creada desde el PDF.");
        onSaved();
        onClose();
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "No se pudo crear la póliza.");
        setStep("review");
      });
  }

  function updateCoverage(index: number, patchFields: Partial<ExtractedCoverage>) {
    if (!data) return;
    const coverages = [...data.coverages];
    coverages[index] = { ...coverages[index], ...patchFields };
    patch({ coverages });
  }

  function updateBeneficiary(index: number, patchFields: Partial<ExtractedBeneficiary>) {
    if (!data) return;
    const beneficiaries = [...data.beneficiaries];
    beneficiaries[index] = { ...beneficiaries[index], ...patchFields };
    patch({ beneficiaries });
  }

  return (
    <Sheet open onClose={onClose} title="Nueva póliza desde PDF">
      <div className="flex flex-col gap-4 p-5">
        {step === "upload" && (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-strong bg-surface-2 p-10 text-center hover:border-accent-500">
            <UploadCloud className="size-8 text-neutral-400" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Arrastrá o hacé clic para subir el PDF de la póliza</p>
            <p className="text-xs text-neutral-500">La IA lee el documento y completa el formulario automáticamente.</p>
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
        )}

        {step === "extracting" && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Sparkles className="size-8 animate-pulse text-accent-500" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Leyendo {fileName} con IA…</p>
            <p className="text-xs text-neutral-500">Esto puede tardar unos segundos.</p>
            <div className="mt-4 flex w-full flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        )}

        {(step === "review" || step === "saving") && data && (
          <>
            <div className="flex items-center gap-2 rounded-md bg-accent-50 p-3 text-xs text-accent-700">
              <Sparkles className="size-4 shrink-0" aria-hidden="true" />
              Revisá y corregí lo que haga falta antes de confirmar — la IA puede haber dejado campos vacíos si no aparecían en el PDF.
            </div>

            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Cliente</p>
            <Input label="Nombre" value={data.clientName ?? ""} onChange={(e) => patch({ clientName: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Teléfono" value={data.phone ?? ""} onChange={(e) => patch({ phone: e.target.value })} />
              <Input label="Email" value={data.email ?? ""} onChange={(e) => patch({ email: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="DNI" value={data.dni ?? ""} onChange={(e) => patch({ dni: e.target.value })} />
              <Input label="CUIT" value={data.cuit ?? ""} onChange={(e) => patch({ cuit: e.target.value })} />
            </div>
            <Input label="Dirección" value={data.address ?? ""} onChange={(e) => patch({ address: e.target.value })} />

            <div className="my-1 h-px bg-border-default" />
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Póliza</p>
            <div className="grid grid-cols-2 gap-3">
              <Input label="N° de póliza" value={data.policyNumber ?? ""} onChange={(e) => patch({ policyNumber: e.target.value })} />
              <Select label="Tipo" value={data.insuranceType} onChange={(e) => patch({ insuranceType: e.target.value as ExtractedPolicyData["insuranceType"] })}>
                {INSURANCE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </div>
            <Input label="Compañía" value={data.company ?? ""} onChange={(e) => patch({ company: e.target.value })} />
            <Input label="Producto" value={data.product ?? ""} onChange={(e) => patch({ product: e.target.value })} />

            <div className="grid grid-cols-3 gap-3">
              <Input label="Emisión" type="date" value={data.issueDate ?? ""} onChange={(e) => patch({ issueDate: e.target.value })} />
              <Input label="Inicio" type="date" value={data.startDate ?? ""} onChange={(e) => patch({ startDate: e.target.value })} />
              <Input label="Vencimiento" type="date" value={data.endDate ?? ""} onChange={(e) => patch({ endDate: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Prima"
                type="number"
                value={data.premium ?? ""}
                onChange={(e) => patch({ premium: e.target.value ? Number(e.target.value) : null })}
              />
              <Input label="Moneda" value={data.premiumCurrency ?? ""} onChange={(e) => patch({ premiumCurrency: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Comisión"
                type="number"
                value={data.commissionAmount ?? ""}
                onChange={(e) => patch({ commissionAmount: e.target.value ? Number(e.target.value) : null })}
              />
              <Input
                label="Suma asegurada"
                type="number"
                value={data.sumInsured ?? ""}
                onChange={(e) => patch({ sumInsured: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
            <Input label="Franquicia / deducible" value={data.deductible ?? ""} onChange={(e) => patch({ deductible: e.target.value })} />

            {data.insuranceType === "auto" && (
              <>
                <div className="my-1 h-px bg-border-default" />
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Vehículo</p>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Marca" value={data.auto?.make ?? ""} onChange={(e) => patch({ auto: { ...(data.auto ?? { make: null, model: null, year: null, plate: null, vin: null, engine: null }), make: e.target.value } })} />
                  <Input label="Modelo" value={data.auto?.model ?? ""} onChange={(e) => patch({ auto: { ...(data.auto ?? { make: null, model: null, year: null, plate: null, vin: null, engine: null }), model: e.target.value } })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Patente" value={data.auto?.plate ?? ""} onChange={(e) => patch({ auto: { ...(data.auto ?? { make: null, model: null, year: null, plate: null, vin: null, engine: null }), plate: e.target.value } })} />
                  <Input
                    label="Año"
                    type="number"
                    value={data.auto?.year ?? ""}
                    onChange={(e) => patch({ auto: { ...(data.auto ?? { make: null, model: null, year: null, plate: null, vin: null, engine: null }), year: e.target.value ? Number(e.target.value) : null } })}
                  />
                </div>
              </>
            )}

            {data.insuranceType === "hogar" && (
              <>
                <div className="my-1 h-px bg-border-default" />
                <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Propiedad</p>
                <Input label="Dirección" value={data.hogar?.address ?? ""} onChange={(e) => patch({ hogar: { ...(data.hogar ?? { address: null, squareMeters: null, propertyType: null }), address: e.target.value } })} />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Tipo de propiedad" value={data.hogar?.propertyType ?? ""} onChange={(e) => patch({ hogar: { ...(data.hogar ?? { address: null, squareMeters: null, propertyType: null }), propertyType: e.target.value } })} />
                  <Input
                    label="m²"
                    type="number"
                    value={data.hogar?.squareMeters ?? ""}
                    onChange={(e) => patch({ hogar: { ...(data.hogar ?? { address: null, squareMeters: null, propertyType: null }), squareMeters: e.target.value ? Number(e.target.value) : null } })}
                  />
                </div>
              </>
            )}

            <div className="my-1 h-px bg-border-default" />
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Coberturas</p>
              <button
                type="button"
                onClick={() => patch({ coverages: [...data.coverages, { name: "", sumInsured: null, deductible: null }] })}
                className="flex items-center gap-1 text-xs font-medium text-accent-600 hover:text-accent-700"
              >
                <Plus className="size-3.5" aria-hidden="true" /> Agregar
              </button>
            </div>
            {data.coverages.length === 0 ? (
              <p className="text-xs text-neutral-500">Sin coberturas detectadas.</p>
            ) : (
              data.coverages.map((cov, i) => (
                <div key={i} className="flex items-end gap-2">
                  <Input label="Nombre" value={cov.name} onChange={(e) => updateCoverage(i, { name: e.target.value })} containerClassName="flex-1" />
                  <Input
                    label="Suma"
                    type="number"
                    value={cov.sumInsured ?? ""}
                    onChange={(e) => updateCoverage(i, { sumInsured: e.target.value ? Number(e.target.value) : null })}
                    containerClassName="w-28"
                  />
                  <button
                    type="button"
                    onClick={() => patch({ coverages: data.coverages.filter((_, idx) => idx !== i) })}
                    className="mb-1 flex size-8 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong"
                    aria-label="Eliminar cobertura"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ))
            )}

            <div className="my-1 h-px bg-border-default" />
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Beneficiarios</p>
              <button
                type="button"
                onClick={() => patch({ beneficiaries: [...data.beneficiaries, { name: "", relationship: null, percentage: null }] })}
                className="flex items-center gap-1 text-xs font-medium text-accent-600 hover:text-accent-700"
              >
                <Plus className="size-3.5" aria-hidden="true" /> Agregar
              </button>
            </div>
            {data.beneficiaries.length === 0 ? (
              <p className="text-xs text-neutral-500">Sin beneficiarios detectados.</p>
            ) : (
              data.beneficiaries.map((b, i) => (
                <div key={i} className="flex items-end gap-2">
                  <Input label="Nombre" value={b.name} onChange={(e) => updateBeneficiary(i, { name: e.target.value })} containerClassName="flex-1" />
                  <Input label="Vínculo" value={b.relationship ?? ""} onChange={(e) => updateBeneficiary(i, { relationship: e.target.value })} containerClassName="w-24" />
                  <Input
                    label="%"
                    type="number"
                    value={b.percentage ?? ""}
                    onChange={(e) => updateBeneficiary(i, { percentage: e.target.value ? Number(e.target.value) : null })}
                    containerClassName="w-16"
                  />
                  <button
                    type="button"
                    onClick={() => patch({ beneficiaries: data.beneficiaries.filter((_, idx) => idx !== i) })}
                    className="mb-1 flex size-8 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong"
                    aria-label="Eliminar beneficiario"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </div>
              ))
            )}

            <Button onClick={handleConfirm} loading={step === "saving"} className="mt-2">
              Confirmar y crear póliza
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}
