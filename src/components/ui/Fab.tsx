import type { ButtonHTMLAttributes } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Floating action button — mobile-only by convention (`md:hidden` baked in,
 * not left to the caller) since desktop already has an inline "Nuevo ..."
 * button in every toolbar; a FAB would just duplicate it. One reusable
 * primitive so a screen only wires its own `onClick`, not the fixed
 * positioning/elevation/size again. */
export function Fab({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "fixed bottom-5 right-5 z-40 flex size-14 items-center justify-center rounded-full",
        "bg-accent-500 text-white shadow-[var(--elevation-lg)] transition-transform duration-[var(--duration-fast)]",
        "hover:bg-accent-600 active:scale-95 md:hidden",
        className,
      )}
      {...props}
    >
      <Plus size={24} aria-hidden="true" />
    </button>
  );
}
