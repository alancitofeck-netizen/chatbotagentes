"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}

/** Right-side slide-in panel — used for the CRM card detail view instead of a
 * modal, so it doesn't block the board underneath (14-design-system.md §10). */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Cerrar panel"
        onClick={onClose}
        className="absolute inset-0 bg-neutral-950/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className={cn(
          // `cn` here is a plain string join (no tailwind-merge in this
          // project), so a caller-provided `className` can't reliably
          // override a conflicting `max-w-*` already baked into the base
          // classes — whichever utility Tailwind happens to emit later in
          // the stylesheet would win, regardless of prop order. Only fall
          // back to the default width when the caller didn't pass one.
          "relative flex h-full w-full flex-col bg-surface-1 shadow-[var(--elevation-lg)]",
          className ?? "max-w-md",
        )}
      >
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
          <div className="text-[15px] font-semibold text-foreground">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-8 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2 hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
