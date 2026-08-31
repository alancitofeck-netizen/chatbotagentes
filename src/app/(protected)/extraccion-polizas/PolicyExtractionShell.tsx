"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Sparkles, UploadCloud, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { toast } from "@/components/toast/toast";
import { cn } from "@/lib/utils/cn";
import { uploadDocumentFile } from "@/lib/documents/uploadClient";
import { recordUploadedDocument } from "@/lib/documents/actions";
import { extractPolicyFromPdfAction, confirmPolicyFromExtractionAction } from "@/lib/policies/actions";
import type { ExtractedPolicyData } from "@/lib/policies/pdfExtraction";
import { computeExtractionConfidence, type ExtractionConfidence } from "@/lib/policies/extractionConfidence";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";
import { useAutoStartTour } from "@/components/onboarding/useAutoStartTour";

type Step = "upload" | "extracting" | "review" | "saving";

const INSURANCE_TYPES = [
  { value: "auto", label: "Auto" },
  { value: "hogar", label: "Hogar" },
  { value: "vida", label: "Vida" },
  { value: "otro", label: "Otro" },
] as const;

const PAYMENT_FREQUENCIES = [
  { value: "mensual", label: "Mensual" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
  { value: "unico", label: "Único" },
] as const;

const CONFIDENCE_VARIANT: Record<ExtractionConfidence, BadgeVariant> = { alta: "success", media: "warning", baja: "error" };
const CONFIDENCE_LABEL: Record<ExtractionConfidence, string> = { alta: "Confianza alta", media: "Confianza media", baja: "Confianza baja" };

function FieldLabel({ children, lowConfidence }: { children: string; lowConfidence?: boolean }) {
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
      {children}
      {lowConfidence && <AlertTriangle className="size-3 text-warning-strong" aria-hidden="true" />}
    </span>
  );
}

function fieldClassName(lowConfidence: boolean) {
  return cn(
    "w-full appearance-none rounded-md border bg-surface-2 px-3 py-2 text-sm text-foreground outline-none transition-colors",
    "focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100",
    lowConfidence ? "border-warning-strong ring-1 ring-warning-strong/30" : "border-border-default",
  );
}

/** Módulo propio "Extracción IA" — mismo motor que ya existía adentro de
 * Pólizas (PolicyPdfUploadSheet.tsx: extractPolicyFromPdfAction +
 * confirmPolicyFromExtractionAction, sin acciones nuevas), pero como
 * pantalla de primer nivel en vez de una hoja modal, con una vista
 * reducida a los 8 campos clave (pedido explícito del usuario, diseño
 * calcado de la referencia) — el resto de los datos que la IA extrae
 * (contacto, coberturas, beneficiarios, etc.) se siguen guardando en la
 * póliza igual, solo no se editan acá; para eso está el detalle completo
 * en /polizas una vez creada. */
export function PolicyExtractionShell({ workspaceId }: { workspaceId: string }) {
  useAutoStartTour("extraction-intro");
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [data, setData] = useState<ExtractedPolicyData | null>(null);
  const [dragOver, setDragOver] = useState(false);

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
      .then(({ id }) => {
        toast.success("Póliza creada y guardada en Pólizas.");
        router.push(`/polizas?policy=${id}`);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "No se pudo crear la póliza.");
        setStep("review");
      });
  }

  function handleStartOver() {
    setStep("upload");
    setDocumentId(null);
    setFileName(null);
    setData(null);
  }

  const lowConfidence = new Set(data?.lowConfidenceFields ?? []);
  const confidence = data ? computeExtractionConfidence(data.lowConfidenceFields) : "alta";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <span className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-accent-600">
          <Zap className="size-3.5" aria-hidden="true" />
          Diferenciador
        </span>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">Extracción de pólizas con IA</h1>
          <ModuleHelp description="Subí el PDF de una póliza y la IA detecta y organiza todos los datos por vos — vos solo revisás y confirmás." tourKey="extraction-intro" />
        </div>
        <p className="text-sm text-neutral-500">Sube el PDF y la IA llena todos los campos por ti</p>

        <label
          data-tour="extraction.dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          className={cn(
            "flex min-h-[220px] cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-surface-1 p-10 text-center transition-colors",
            dragOver ? "border-accent-500 bg-accent-50" : "border-border-strong hover:border-accent-500",
          )}
        >
          <UploadCloud className="size-8 text-neutral-400" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">Arrastra el PDF de la póliza</p>
          <p className="text-xs text-neutral-500">o haz clic para subir</p>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            disabled={step === "extracting" || step === "saving"}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </label>

        <p className="text-xs text-neutral-500">La IA lee el documento y empata con tu cartera. Tú revisas y confirmas.</p>

        {fileName && step !== "upload" && (
          <p className="text-xs text-neutral-400">
            Archivo: <span className="text-foreground">{fileName}</span>
            {(step === "review" || step === "saving") && (
              <button type="button" onClick={handleStartOver} className="ml-2 font-medium text-accent-600 hover:text-accent-700">
                Subir otro
              </button>
            )}
          </p>
        )}
      </div>

      <Card className="flex flex-col gap-4">
        {step === "upload" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 py-16 text-center text-neutral-500">
            <Sparkles className="size-6" aria-hidden="true" />
            <p className="text-sm">Los datos extraídos van a aparecer acá.</p>
          </div>
        )}

        {step === "extracting" && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
            <Loader2 className="size-8 animate-spin text-accent-500" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Leyendo {fileName} con IA…</p>
            <p className="text-xs text-neutral-500">Esto puede tardar unos segundos.</p>
          </div>
        )}

        {(step === "review" || step === "saving") && data && (
          <>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-accent-500" aria-hidden="true" />
              <h2 className="text-sm font-semibold text-foreground">Datos extraídos</h2>
              <Badge variant={CONFIDENCE_VARIANT[confidence]}>{CONFIDENCE_LABEL[confidence]}</Badge>
            </div>
            <p className="-mt-2 text-xs text-neutral-500">Revisa los campos en amarillo antes de guardar</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <FieldLabel lowConfidence={lowConfidence.has("company")}>Aseguradora</FieldLabel>
                <input className={fieldClassName(lowConfidence.has("company"))} value={data.company ?? ""} onChange={(e) => patch({ company: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel lowConfidence={lowConfidence.has("policyNumber")}>No. Póliza</FieldLabel>
                <input className={fieldClassName(lowConfidence.has("policyNumber"))} value={data.policyNumber ?? ""} onChange={(e) => patch({ policyNumber: e.target.value })} />
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel lowConfidence={lowConfidence.has("clientName")}>Contratante</FieldLabel>
                <input className={fieldClassName(lowConfidence.has("clientName"))} value={data.clientName ?? ""} onChange={(e) => patch({ clientName: e.target.value })} />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel lowConfidence={lowConfidence.has("insuranceType")}>Ramo</FieldLabel>
                <select
                  className={fieldClassName(lowConfidence.has("insuranceType"))}
                  value={data.insuranceType}
                  onChange={(e) => patch({ insuranceType: e.target.value as ExtractedPolicyData["insuranceType"] })}
                >
                  {INSURANCE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel lowConfidence={lowConfidence.has("premium")}>Prima</FieldLabel>
                <input
                  type="number"
                  className={fieldClassName(lowConfidence.has("premium"))}
                  value={data.premium ?? ""}
                  onChange={(e) => patch({ premium: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel lowConfidence={lowConfidence.has("paymentFrequency")}>Frecuencia</FieldLabel>
                <select
                  className={fieldClassName(lowConfidence.has("paymentFrequency"))}
                  value={data.paymentFrequency ?? ""}
                  onChange={(e) => patch({ paymentFrequency: (e.target.value || null) as ExtractedPolicyData["paymentFrequency"] })}
                >
                  <option value="">Sin especificar</option>
                  {PAYMENT_FREQUENCIES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <FieldLabel lowConfidence={lowConfidence.has("sumInsured")}>Suma asegurada</FieldLabel>
                <input
                  type="number"
                  className={fieldClassName(lowConfidence.has("sumInsured"))}
                  value={data.sumInsured ?? ""}
                  onChange={(e) => patch({ sumInsured: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel lowConfidence={lowConfidence.has("endDate")}>Vencimiento</FieldLabel>
                <input
                  type="date"
                  className={fieldClassName(lowConfidence.has("endDate"))}
                  value={data.endDate ?? ""}
                  onChange={(e) => patch({ endDate: e.target.value || null })}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={step === "saving"}
              className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-success text-sm font-medium text-white transition-colors hover:bg-success/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {step === "saving" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="size-4" aria-hidden="true" />}
              Confirmar y guardar en Pólizas
            </button>
          </>
        )}
      </Card>
    </div>
  );
}
