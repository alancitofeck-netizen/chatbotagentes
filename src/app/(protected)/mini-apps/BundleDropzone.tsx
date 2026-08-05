"use client";

import { useRef, useState } from "react";
import { UploadCloud, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { formatFileSize } from "@/components/documents/documentIcons";
import { parseBundle, MAX_BUNDLE_BYTES, type ParsedBundle } from "@/lib/miniApps/bundleParser";

export interface BundleUploadResult {
  bundleVersion: number;
  indexPath: string;
  counts: { css: number; js: number; images: number };
  totalBytes: number;
  publicUrl: string;
  /** Freshly (re)generated on every upload/replace — bundle-upload/route.ts
   * always embeds this exact key into the uploaded index.html via
   * injectSdkSnippet, so it's the only value that's actually valid against
   * the bundle currently being served (see LinkAppWizard.tsx). */
  apiKey: string;
}

/** Drag & drop + instant client-side preview, shared between LinkAppWizard's
 * "Subir archivo" tab (creates the mini app just-in-time on the first valid
 * file, via ensureMiniAppId) and ConfiguracionTab's "Actualizar aplicación"
 * (replaces an existing one — ensureMiniAppId there just returns the current
 * id). bundleParser.ts runs client-side first so the preview (index.html
 * found, CSS/JS/image counts, size) shows before anything is uploaded — only
 * a file that parses successfully ever reaches the server. */
export function BundleDropzone({
  ensureMiniAppId,
  onUploaded,
  onPreview,
  disabled = false,
}: {
  ensureMiniAppId: () => Promise<string>;
  onUploaded: (result: BundleUploadResult) => void;
  onPreview: (publicUrl: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedBundle | null>(null);
  const [result, setResult] = useState<BundleUploadResult | null>(null);

  async function handleFile(file: File) {
    if (disabled || isBusy) return;
    if (file.size > MAX_BUNDLE_BYTES) {
      toast.error(`El archivo supera el máximo de ${MAX_BUNDLE_BYTES / (1024 * 1024)} MB.`);
      return;
    }
    setIsBusy(true);
    setFileName(file.name);
    setResult(null);
    setPreview(null);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const parsed = await parseBundle(file.name, bytes);
      if (!parsed.ok) {
        toast.error(parsed.error);
        setFileName(null);
        return;
      }
      setPreview(parsed.bundle);

      const miniAppId = await ensureMiniAppId();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("miniAppId", miniAppId);
      const response = await fetch("/api/mini-apps/bundle-upload", { method: "POST", body: formData });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "No se pudo publicar la aplicación.");
      setResult(data as BundleUploadResult);
      onUploaded(data as BundleUploadResult);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo publicar la aplicación.");
      setFileName(null);
      setPreview(null);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && !isBusy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          isDragOver ? "border-accent-500 bg-accent-500/5" : "border-border-default bg-surface-2"
        } ${disabled || isBusy ? "pointer-events-none opacity-50" : ""}`}
      >
        <UploadCloud className="size-8 text-neutral-400" aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">📁 Arrastrá tu aplicación aquí</p>
        <p className="text-xs text-neutral-500">o hacé clic para seleccionar — HTML • ZIP • Máximo {MAX_BUNDLE_BYTES / (1024 * 1024)} MB</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || isBusy}
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Seleccionar archivo
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".html,.htm,.zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void handleFile(file);
          }}
        />
      </div>

      {isBusy && <p className="text-xs text-neutral-500">{fileName ? `Procesando ${fileName}…` : "Procesando…"}</p>}

      {preview && result && (
        <div className="flex flex-col gap-2 rounded-lg border border-border-default bg-surface-1 p-4 text-sm">
          <p className="font-medium text-foreground">✓ Aplicación encontrada</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-neutral-500">
            <span>Archivo principal</span>
            <span className="text-foreground">{preview.indexPath}</span>
            <span>CSS</span>
            <span className="text-foreground">{preview.counts.css} archivo(s)</span>
            <span>JavaScript</span>
            <span className="text-foreground">{preview.counts.js} archivo(s)</span>
            <span>Imágenes</span>
            <span className="text-foreground">{preview.counts.images} archivo(s)</span>
            <span>Tamaño</span>
            <span className="text-foreground">{formatFileSize(preview.totalBytes)}</span>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" size="sm" onClick={() => onPreview(result.publicUrl)}>
              Vista previa
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={disabled || isBusy} onClick={() => inputRef.current?.click()}>
              <RefreshCw className="size-3.5" aria-hidden="true" />
              Reemplazar archivo
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
