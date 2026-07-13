"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export interface DropdownMenuItem {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
}

/** Small hand-rolled positioned menu — no formal Popover/Menu primitive
 * exists yet in src/components/ui/ (same reasoning as ContactPicker's
 * hand-rolled dropdown results list), extracted here since the Documents
 * grid needs the same "⋮" context menu on every card. Closes on outside
 * click or Escape. */
export function DropdownMenu({
  trigger,
  items,
  align = "end",
  triggerClassName,
  triggerLabel,
}: {
  trigger: ReactNode;
  items: DropdownMenuItem[];
  align?: "start" | "end";
  triggerClassName?: string;
  /** Only pass this for icon-only triggers (e.g. a bare "⋮" button) — a
   * trigger with its own visible text (e.g. "Nuevo") should be left
   * unlabeled so aria-label doesn't override that text as the accessible
   * name. */
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={triggerClassName ?? "flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground"}
      >
        {trigger}
      </button>
      {open && (
        <div
          className={cn(
            "absolute top-full z-20 mt-1 w-44 overflow-hidden rounded-lg border border-border-default bg-surface-1 py-1 shadow-[var(--elevation-md)]",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={item.disabled}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                item.destructive ? "text-error-strong hover:bg-error-bg" : "text-foreground hover:bg-surface-2",
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
