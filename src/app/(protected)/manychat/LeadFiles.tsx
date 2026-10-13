"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, FileText, Loader2, TrendingUp, Trash2, Upload } from "lucide-react";
import { toast } from "@/components/toast/toast";
import { uploadDocumentFile } from "@/lib/documents/uploadClient";
import { getDownloadUrl, recordUploadedDocument, trashDocument } from "@/lib/documents/actions";
import type { Lead } from "@/lib/manychat/leads";
import { ensureLeadRecordAction } from "./actions";

const MAX_BYTES = 25 * 1024 * 1024;

const buttonClass =
  "inline-flex h-11 items-center gap-2 rounded-xl border border-border-default bg-surface-1 px-4 text-[14px] font-semibold text-foreground hover:border-border-strong disabled:opacity-60";

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

/** PDFs de un lead de ManyChat: las proyecciones que hizo en las mini apps (mismo teléfono, el PDF de la ficha
 * del lead) y los PDFs que el asesor le sube. Los subidos se guardan en Documentos (related_type
 * "manychat_lead"); "Quitar" los manda a la papelera de Documentos, de donde se pueden recuperar. */
export function LeadFiles({ lead, canEdit }: { lead: Lead; canEdit: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const archivos = lead.archivos ?? [];
  const proyecciones = lead.proyecciones ?? [];

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      toast.error("Elegí un archivo PDF.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("El PDF pesa más de 25 MB.");
      return;
    }
    setUploading(true);
    try {
      const record = await ensureLeadRecordAction(lead.ref);
      if (!record.ok) {
        toast.error(record.error);
        return;
      }
      const storagePath = `${record.workspaceId}/${crypto.randomUUID()}/${file.name}`;
      if (!(await uploadDocumentFile(storagePath, file))) {
        toast.error("No se pudo subir el PDF.");
        return;
      }
      await recordUploadedDocument({
        name: file.name,
        folderId: null,
        mimeType: file.type,
        sizeBytes: file.size,
        storagePath,
        relatedType: "manychat_lead",
        relatedId: record.recordId,
      });
      toast.success("PDF guardado en el lead.");
      router.refresh();
    } catch {
      toast.error("No se pudo guardar el PDF.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleView(documentId: string) {
    // La pestaña se abre antes de pedir el link (con un await en el medio, el navegador del celular la bloquea).
    const tab = window.open("", "_blank");
    setBusyId(documentId);
    const url = await getDownloadUrl(documentId).catch(() => null);
    setBusyId(null);
    if (!url) {
      tab?.close();
      toast.error("No se pudo abrir el PDF.");
      return;
    }
    if (tab) tab.location.href = url;
    else window.location.assign(url);
  }

  async function handleRemove(documentId: string, name: string) {
    if (!window.confirm(`¿Quitar "${name}" de este lead? Queda en la papelera de Documentos.`)) return;
    setBusyId(documentId);
    try {
      await trashDocument(documentId);
      toast.success("PDF quitado.");
      router.refresh();
    } catch {
      toast.error("No se pudo quitar el PDF.");
    } finally {
      setBusyId(null);
    }
  }

  if (!canEdit && archivos.length === 0 && proyecciones.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 border-t border-border-default pt-3">
      <p className="text-[12px] font-semibold tracking-wide text-neutral-500 uppercase">Proyecciones y PDFs</p>

      {proyecciones.map((p) => (
        <a
          key={p.leadId}
          href={`/api/mini-apps/leads/${p.leadId}/pdf?ver=1`}
          target="_blank"
          rel="noopener"
          className="flex min-h-11 items-center gap-2.5 rounded-xl border border-border-default bg-surface-1 px-3 py-2 text-[14px] text-foreground hover:border-border-strong"
        >
          <TrendingUp className="size-4 shrink-0 text-accent-600" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">Ver proyección</span>
            <span className="block truncate text-[12.5px] text-neutral-500">
              {p.origen} · {formatDay(p.fecha)}
            </span>
          </span>
          <Eye className="size-4 shrink-0 text-neutral-400" aria-hidden="true" />
        </a>
      ))}

      {archivos.map((doc) => (
        <div key={doc.id} className="flex min-h-11 items-center gap-2 rounded-xl border border-border-default bg-surface-1 px-3 py-1.5">
          <FileText className="size-4 shrink-0 text-error-strong" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-[14px] text-foreground">{doc.name}</span>
          <button
            type="button"
            onClick={() => handleView(doc.id)}
            disabled={busyId === doc.id}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-semibold text-accent-700 hover:bg-surface-2 disabled:opacity-60"
          >
            {busyId === doc.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
            Ver
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={() => handleRemove(doc.id, doc.name)}
              disabled={busyId === doc.id}
              aria-label={`Quitar ${doc.name}`}
              className="flex size-9 items-center justify-center rounded-lg text-neutral-500 hover:bg-surface-2 hover:text-error-strong disabled:opacity-60"
            >
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      ))}

      {canEdit && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading} className={`${buttonClass} w-fit`}>
            {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />}
            {uploading ? "Subiendo…" : "Subir PDF"}
          </button>
        </>
      )}
    </div>
  );
}
