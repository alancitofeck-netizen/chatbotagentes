"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
 * grid needs the same "⋮" context menu on every card. Renders through a
 * portal into document.body and positions itself from the trigger's
 * bounding rect — needed because callers (e.g. a scrollable table) may
 * clip an in-flow absolutely-positioned menu via ancestor `overflow`.
 * Closes on outside click, Escape, or scroll/resize. */
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
  const [position, setPosition] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition(
      align === "end"
        ? { top: rect.bottom + 4, right: window.innerWidth - rect.right }
        : { top: rect.bottom + 4, left: rect.left },
    );
  }, [open, align]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function handleReposition() {
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("resize", handleReposition);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("resize", handleReposition);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
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
      {open &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: position.top, left: position.left, right: position.right }}
            className={cn("fixed z-50 w-44 overflow-hidden rounded-lg border border-border-default bg-surface-1 py-1 shadow-[var(--elevation-md)]")}
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
          </div>,
          document.body,
        )}
    </>
  );
}
