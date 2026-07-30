"use client";

import { useEffect, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/toast/toast";
import { uploadDocumentFile } from "@/lib/documents/uploadClient";
import { fileTypeMetaFor, formatFileSize } from "@/components/documents/documentIcons";
import type { DocumentItem } from "@/lib/documents/queries";
import { getDocumentsByRelatedAction, getDownloadUrl, recordUploadedDocument, trashDocument } from "@/lib/documents/actions";

/** "Archivos" tab — identical mechanism to CardDetailSheet's own "Archivos"
 * tab for opportunities: uploads through /api/documents/upload (see
 * src/lib/documents/uploadClient.ts), then recordUploadedDocument just
 * records the row with related_type='task'. */
export function ArchivosTab({ taskId, workspaceId }: { taskId: string; workspaceId: string }) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    getDocumentsByRelatedAction("task", taskId).then((fresh) => {
      setDocuments(fresh);
      setLoaded(true);
    });
  }, [taskId]);

  async function handleUploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const documentId = crypto.randomUUID();
      const storagePath = `${workspaceId}/${documentId}/${file.name}`;
      const uploaded = await uploadDocumentFile(storagePath, file);
      if (!uploaded) {
        toast.error(`No se pudo subir ${file.name}.`);
        continue;
      }
      try {
        await recordUploadedDocument({
          name: file.name,
          folderId: null,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          storagePath,
          relatedType: "task",
          relatedId: taskId,
        });
      } catch {
        toast.error(`No se pudo registrar ${file.name}.`);
      }
    }
    setDocuments(await getDocumentsByRelatedAction("task", taskId));
    setUploading(false);
    toast.success("Archivo(s) subido(s).");
  }

  async function handleDownload(documentId: string) {
    const url = await getDownloadUrl(documentId);
    if (url) window.open(url, "_blank");
  }

  async function handleDelete(documentId: string) {
    if (!window.confirm("¿Eliminar este archivo?")) return;
    await trashDocument(documentId);
    setDocuments(await getDocumentsByRelatedAction("task", taskId));
  }

  if (!loaded) return <Skeleton className="h-24 w-full" />;

  return (
    <div className="flex flex-col gap-3">
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border-strong px-3 py-3 text-sm text-neutral-500 hover:border-accent-500 hover:text-accent-600">
        <Upload size={15} aria-hidden="true" />
        {uploading ? "Subiendo…" : "Subir archivo"}
        <input type="file" multiple className="hidden" disabled={uploading} onChange={(e) => handleUploadFiles(e.target.files)} />
      </label>
      {documents.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin archivos todavía.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {documents.map((doc) => {
            const meta = fileTypeMetaFor(doc.name);
            const Icon = meta.icon;
            return (
              <li key={doc.id} className="flex items-center gap-2 rounded-md bg-surface-2 p-3">
                <Icon size={16} className={meta.color} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{doc.name}</p>
                  <p className="text-xs text-neutral-500">{formatFileSize(doc.sizeBytes)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(doc.id)}
                  className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground"
                  aria-label="Descargar"
                >
                  <Download size={14} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(doc.id)}
                  className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong"
                  aria-label="Eliminar"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
