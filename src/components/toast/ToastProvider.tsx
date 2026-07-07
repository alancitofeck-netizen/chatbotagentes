"use client";

import { Toaster } from "sonner";

/**
 * Thin wrapper over sonner, restyled with our own tokens via `toastOptions`
 * (not sonner's default theme) so toasts match 14-design-system.md exactly.
 * Use `toast(...)` from "@/components/toast/toast" to fire toasts.
 */
export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      duration={4000}
      toastOptions={{
        unstyled: true,
        classNames: {
          toast:
            "flex items-center gap-2.5 rounded-md bg-surface-1 border border-border-default px-4 py-3 shadow-[var(--elevation-md)] text-sm text-foreground w-full",
          title: "font-medium",
          description: "text-neutral-500 text-[13px]",
          success: "[&_[data-icon]]:text-[var(--color-success)]",
          error: "[&_[data-icon]]:text-[var(--color-error)]",
          warning: "[&_[data-icon]]:text-[var(--color-warning)]",
        },
      }}
    />
  );
}
