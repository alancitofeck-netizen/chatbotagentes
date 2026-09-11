"use client";

import { useEffect } from "react";
import { Download, X } from "lucide-react";

/** Visor de PDF/imagen embebido — sin salir de Growth Link, sin librerías
 * nuevas: un PDF se abre en un <iframe>, que en todo navegador moderno ya
 * trae su propio visor nativo (páginas, zoom, pantalla completa) gratis.
 * Mismo patrón de overlay que el drawer móvil de CoursePlayerShell.tsx
 * (fixed inset-0 + Escape para cerrar), pero a pantalla completa en vez de
 * un panel lateral, porque acá el contenido (no la navegación) es el
 * protagonista. */
export function ResourceViewerModal({
  title,
  fileUrl,
  kind,
  onClose,
}: {
  title: string;
  fileUrl: string;
  kind: "pdf" | "image";
  onClose: () => void;
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-950/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl bg-surface-1 shadow-[var(--elevation-lg)]">
        <div className="flex items-center justify-between gap-3 border-b border-border-default px-4 py-3">
          <p className="min-w-0 truncate text-[14px] font-semibold text-foreground">{title}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              download
              className="flex items-center gap-1.5 rounded-md border border-border-default px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-2"
            >
              <Download size={14} aria-hidden="true" />
              Descargar
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2 hover:text-foreground"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-surface-2">
          {kind === "pdf" ? (
            <iframe src={fileUrl} title={title} className="size-full border-0" />
          ) : (
            <div className="flex size-full items-center justify-center overflow-auto p-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- remote Storage URL, dimensions are dynamic */}
              <img src={fileUrl} alt={title} className="max-h-full max-w-full object-contain" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
