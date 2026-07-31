"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/** Wraps the same sandboxed iframe the public /apps/{slug} page uses for
 * hostingMode "upload" apps — preview and production render identically,
 * this isn't a separate mock. Deliberately no allow-same-origin: the
 * uploaded HTML gets an opaque origin, so it can neither read GrowthLink's
 * cookies/DOM nor ride the visitor's session on its own fetch() calls. */
export function BundlePreviewModal({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Capture phase + stopPropagation — this modal can be opened from
      // inside LinkAppWizard/ConfiguracionTab's own Sheet, which has its own
      // bubble-phase Escape listener already registered on `document`.
      // Without this, Escape would close both at once (Sheet's listener
      // fires first since it mounted first) instead of just this modal.
      e.stopPropagation();
      onClose();
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-neutral-950/60 p-4 sm:p-8">
      <div className="relative flex h-full w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-surface-1 shadow-[var(--elevation-lg)]">
        <div className="flex items-center justify-between border-b border-border-default px-4 py-2">
          <span className="text-sm font-medium text-foreground">Vista previa</span>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="text-neutral-500 hover:text-foreground">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <iframe
          src={url}
          sandbox="allow-scripts allow-forms allow-popups"
          className="h-full w-full flex-1 border-0 bg-white"
          title="Vista previa de la aplicación"
        />
      </div>
    </div>
  );
}
