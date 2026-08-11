"use client";

import { useState } from "react";
import { UploadCloud, FileText, Download } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/toast/toast";
import { uploadDocumentFile } from "@/lib/documents/uploadClient";
import { recordUploadedDocument, getDownloadUrl, getDocumentsByRelatedAction } from "@/lib/documents/actions";
import type { DocumentItem } from "@/lib/documents/queries";

const CATEGORIES = [
  { value: "contrato", label: "Contrato" },
  { value: "onboarding", label: "Onboarding" },
  { value: "analisis_mercado", label: "Análisis de mercado" },
  { value: "cliente_ideal", label: "Cliente ideal" },
  { value: "estructura_mensajes", label: "Estructura de mensajes" },
  { value: "presentacion_comercial", label: "Presentación comercial" },
  { value: "creatividades", label: "Creatividades" },
  { value: "reportes", label: "Reportes" },
  { value: "scripts", label: "Scripts" },
  { value: "recursos", label: "Recursos" },
  { value: "mini_apps", label: "Mini Apps" },
];

const CATEGORY_LABEL = new Map(CATEGORIES.map((c) => [c.value, c.label]));

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ClientDocumentsPanel({ clientId, initialDocuments }: { clientId: string; initialDocuments: DocumentItem[] }) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [uploading, setUploading] = useState(false);

  async function refetch() {
    setDocuments(await getDocumentsByRelatedAction("client", clientId));
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const storageId = crypto.randomUUID();
      const storagePath = `${clientId}/${storageId}/${file.name}`;
      const uploaded = await uploadDocumentFile(storagePath, file);
      if (!uploaded) throw new Error("No se pudo subir el archivo.");
      await recordUploadedDocument({
        name: file.name,
        folderId: null,
        mimeType: file.type,
        sizeBytes: file.size,
        storagePath,
        relatedType: "client",
        relatedId: clientId,
        docCategory: category,
      });
      toast.success("Documento subido.");
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir el documento.");
    } finally {
      setUploading(false);
    }
  }

  async function handleOpen(documentId: string) {
    const url = await getDownloadUrl(documentId);
    if (url) window.open(url, "_blank");
    else toast.error("No se pudo abrir el documento.");
  }

  return (
    <Card>
      <CardHeader title="Documentos del cliente" />
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Select label="Categoría" value={category} onChange={(e) => setCategory(e.target.value)} containerClassName="w-56">
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
        <label className="flex h-[38px] cursor-pointer items-center gap-1.5 rounded-sm border border-dashed border-border-strong px-3 text-[13px] font-medium text-neutral-500 hover:border-accent-500 hover:text-accent-600">
          <UploadCloud size={14} aria-hidden="true" />
          {uploading ? "Subiendo…" : "Subir documento"}
          <input
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
            }}
          />
        </label>
      </div>

      {documents.length === 0 ? (
        <EmptyState icon={FileText} title="Sin documentos" description="Subí el primer archivo de este cliente." />
      ) : (
        <div className="flex flex-col gap-2">
          {documents.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => handleOpen(doc.id)}
              className="flex items-center justify-between rounded-lg bg-surface-2 px-3 py-2.5 text-left text-sm hover:bg-surface-3"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <FileText className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{doc.name}</p>
                  <p className="text-xs text-neutral-500">
                    {doc.docCategory ? (CATEGORY_LABEL.get(doc.docCategory) ?? doc.docCategory) : "Sin categoría"} · {formatBytes(doc.sizeBytes)}
                  </p>
                </div>
              </div>
              <Download className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
