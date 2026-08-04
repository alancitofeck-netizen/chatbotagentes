"use client";

import { useLayoutEffect, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";

type TooltipSide = "right" | "left" | "top" | "bottom";

/** Small hand-rolled positioned tooltip — no formal Tooltip primitive
 * existed yet in src/components/ui/ (first consumer: Sidebar.tsx's
 * collapsed-icon labels), same "portal + getBoundingClientRect from a
 * trigger ref" approach as DropdownMenu.tsx, the one existing precedent
 * for a positioned overlay in this codebase. Portal'd into document.body
 * (not rendered inline next to the trigger) so it's never clipped by an
 * ancestor's `overflow-hidden` or buried under a lower stacking context —
 * both real risks for a trigger that lives inside a narrow, animating
 * sidebar rail.
 *
 * Visibility is fully controlled by the caller (`open` prop) rather than
 * driven by its own mouseenter/mouseleave — the caller already has to
 * track hover/focus state for its own styling, so this avoids two
 * independent hover-tracking implementations drifting out of sync. */
export function Tooltip<T extends HTMLElement>({
  id,
  targetRef,
  open,
  side = "right",
  children,
}: {
  id: string;
  targetRef: RefObject<T | null>;
  open: boolean;
  side?: TooltipSide;
  children: ReactNode;
}) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !targetRef.current) {
      setPosition(null);
      return;
    }
    const rect = targetRef.current.getBoundingClientRect();
    const gap = 8;
    switch (side) {
      case "right":
        setPosition({ top: rect.top + rect.height / 2, left: rect.right + gap });
        break;
      case "left":
        setPosition({ top: rect.top + rect.height / 2, left: rect.left - gap });
        break;
      case "bottom":
        setPosition({ top: rect.bottom + gap, left: rect.left + rect.width / 2 });
        break;
      case "top":
        setPosition({ top: rect.top - gap, left: rect.left + rect.width / 2 });
        break;
    }
  }, [open, targetRef, side]);

  if (!open || !position) return null;

  const translate =
    side === "right"
      ? "-translate-y-1/2"
      : side === "left"
        ? "-translate-x-full -translate-y-1/2"
        : side === "bottom"
          ? "-translate-x-1/2"
          : "-translate-x-1/2 -translate-y-full";

  return createPortal(
    <div
      id={id}
      role="tooltip"
      style={{ top: position.top, left: position.left }}
      className={cn(
        "pointer-events-none fixed z-[70] whitespace-nowrap rounded-md bg-neutral-900 px-2.5 py-1.5 text-xs font-medium text-white shadow-[var(--elevation-md)]",
        translate,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
