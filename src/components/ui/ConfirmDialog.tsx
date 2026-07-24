"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}

/** Centered confirmation modal — distinct from Sheet.tsx's slide-in panel
 * (used for editing forms), reserved for "are you sure" confirmations that
 * need more context than a native window.confirm() (e.g. showing exactly
 * what's about to change), starting with AgentsList's "Cambiar rol". */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  isLoading = false,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Cerrar" onClick={onCancel} className="absolute inset-0 bg-neutral-950/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-lg bg-surface-1 p-5 shadow-[var(--elevation-lg)]"
      >
        <div>
          <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
          {description && <div className="mt-1 text-sm text-neutral-500">{description}</div>}
        </div>
        {children}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button type="button" onClick={onConfirm} loading={isLoading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
