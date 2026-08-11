"use client";

import { useEffect, useState } from "react";
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

/** Right-side slide-in panel on desktop; bottom sheet on mobile (optimización
 * mobile plan §3) — one component, not two, so every existing caller (CRM
 * card detail, lead form, etc.) gets the mobile treatment for free. Below
 * `sm` the panel anchors to the bottom, capped at 92vh instead of forced
 * full-height, with rounded top corners; at `sm:` and up it's the original
 * right-anchored full-height panel, unchanged (14-design-system.md §10).
 *
 * Slide in/out transition: `isRendered` keeps the panel mounted for one
 * transition duration after `open` flips false so the exit animation can
 * actually play (a plain `if (!open) return null` — the original
 * implementation — unmounts instantly, no exit transition possible).
 * `isVisible` is the one that actually drives the transform/opacity, set on
 * the next frame after mount so the browser paints the "closed" position
 * first instead of skipping straight to "open" with no visible transition. */
export function Sheet({ open, onClose, title, children, className }: SheetProps) {
  const [isRendered, setIsRendered] = useState(open);
  const [isVisible, setIsVisible] = useState(false);

  // Mount immediately when `open` flips true — a render-time state
  // adjustment (React's sanctioned pattern for this, see Sidebar.tsx's
  // hasFinishedExpanding), not an effect, so the panel is in the DOM before
  // the next effect schedules the "slide to open" transform on the next frame.
  if (open && !isRendered) setIsRendered(true);

  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    Promise.resolve().then(() => setIsVisible(false));
    const timeout = setTimeout(() => setIsRendered(false), 220);
    return () => clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!isRendered) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-stretch sm:justify-end">
      <button
        aria-label="Cerrar panel"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-neutral-950/40 transition-opacity duration-[220ms] ease-[var(--ease-out)]",
          isVisible ? "opacity-100" : "opacity-0",
        )}
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
          // `w-full` + a phone-width viewport already keeps this narrower
          // than any typical `max-w-*` a caller passes, so that constraint
          // only actually bites at `sm:` and up, unprefixed on purpose.
          "relative flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-surface-1 shadow-[var(--elevation-lg)] transition-transform duration-[220ms] ease-[var(--ease-out)] sm:h-full sm:max-h-full sm:rounded-none",
          isVisible ? "translate-y-0 sm:translate-x-0" : "translate-y-full sm:translate-y-0 sm:translate-x-full",
          className ?? "max-w-md",
        )}
      >
        <div className="flex items-center justify-between border-b border-border-default px-5 py-4">
          <div className="text-[15px] font-semibold text-foreground">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2 hover:text-foreground"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
