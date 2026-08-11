"use client";

import { useMemo, useState } from "react";
import { UploadCloud, FileText, Download, FolderOpen, HardDrive, ShieldCheck, CalendarClock, Search, Folders } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { EmptyState } from "@/components/ui/EmptyState";
import { MetricCard } from "@/components/responseSummary/MetricCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { toast } from "@/components/toast/toast";
import { uploadDocumentFile } from "@/lib/documents/uploadClient";
import { recordUploadedDocument, getDownloadUrl, getDocumentsByRelatedAction } from "@/lib/documents/actions";
import type { DocumentItem } from "@/lib/documents/queries";

/** Nombres alineados a la referencia visual del perfil de Cliente — mismo
 * mecanismo que el resto del CRM (documents.doc_category, texto libre sin
 * CHECK, 0095), solo cambia la lista de opciones para este contexto. */
const CATEGORIES = [
  { value: "contratos", label: "Contratos" },
  { value: "reportes", label: "Reportes" },
  { value: "facturacion", label: "Facturación" },
  { value: "presentaciones", label: "Presentaciones" },
  { value: "estrategias", label: "Estrategias" },
  { value: "otros", label: "Otros" },
];

const CATEGORY_LABEL = new Map(CATEGORIES.map((c) => [c.value, c.label]));

/** Tope de referencia visual — no existe ningún concepto real de cuota de
 * almacenamiento por cliente hoy en el sistema, así que esto es solo para
 * mostrar la barra de uso; no bloquea nada si se supera. */
const STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024;

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatGb(bytes: number) {
  return (bytes / (1024 * 1024 * 1024)).toFixed(2);
}

export function ClientDocumentsPanel({
  clientId,
  initialDocuments,
  contractsCount,
  contractsExpiringSoon,
}: {
  clientId: string;
  initialDocuments: DocumentItem[];
  contractsCount: number;
  contractsExpiringSoon: number;
}) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [uploading, setUploading] = useState(false);
  const [search, setSearch] = useState("");
  const [folderFilter, setFolderFilter] = useState<string | "all">("all");

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

  const countByFolder = useMemo(() => {
    const map = new Map<string, number>();
    for (const doc of documents) {
      const key = doc.docCategory ?? "otros";
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [documents]);

  const totalBytes = useMemo(() => documents.reduce((sum, d) => sum + (d.sizeBytes ?? 0), 0), [documents]);
  const usedPct = Math.min(100, Math.round((totalBytes / STORAGE_QUOTA_BYTES) * 100));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return documents.filter((doc) => {
      if (folderFilter !== "all" && (doc.docCategory ?? "otros") !== folderFilter) return false;
      if (q && !doc.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [documents, search, folderFilter]);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard icon={FileText} label="Documentos totales" value={String(documents.length)} />
        <MetricCard icon={Folders} label="Carpetas" value={String(CATEGORIES.length)} />
        <MetricCard icon={HardDrive} label="Almacenamiento usado" value={`${formatGb(totalBytes)} GB`} />
        <MetricCard icon={ShieldCheck} label="Contratos" value={String(contractsCount)} />
        <MetricCard icon={CalendarClock} label="Vencen pronto" value={String(contractsExpiringSoon)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Carpetas" />
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => setFolderFilter("all")}
                className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm ${folderFilter === "all" ? "bg-accent-500/10 text-accent-700" : "text-foreground hover:bg-surface-2"}`}
              >
                <span className="flex items-center gap-2">
                  <FolderOpen className="size-3.5" aria-hidden="true" />
                  Todos los documentos
                </span>
                <span className="text-xs text-neutral-500">{documents.length}</span>
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setFolderFilter(c.value)}
                  className={`flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm ${folderFilter === c.value ? "bg-accent-500/10 text-accent-700" : "text-foreground hover:bg-surface-2"}`}
                >
                  <span className="flex items-center gap-2">
                    <FolderOpen className="size-3.5" aria-hidden="true" />
                    {c.label}
                  </span>
                  <span className="text-xs text-neutral-500">{countByFolder.get(c.value) ?? 0}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-400">Almacenamiento</p>
            <ProgressBar value={usedPct} />
            <p className="mt-2 text-xs text-neutral-500">
              {formatGb(totalBytes)} GB de {formatGb(STORAGE_QUOTA_BYTES)} GB usados ({usedPct}%)
            </p>
          </Card>
        </div>

        <Card>
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar documentos…"
                className="h-[38px] w-full rounded-sm border border-border-strong bg-surface-1 pr-3 pl-9 text-sm text-foreground placeholder:text-neutral-400 outline-none focus:border-accent-500"
              />
            </div>
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
          ) : filtered.length === 0 ? (
            <p className="p-4 text-center text-sm text-neutral-500">Ningún documento coincide con la búsqueda.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((doc) => (
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
      </div>
    </div>
  );
}
