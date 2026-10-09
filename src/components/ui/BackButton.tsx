"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** Volver a la pantalla anterior; si se entró directo (sin historial), al inicio. */
export function BackButton({ className, fallbackHref = "/dashboard" }: { className?: string; fallbackHref?: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      aria-label="Volver"
      onClick={() => (window.history.length > 1 ? router.back() : router.push(fallbackHref))}
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-xl border border-border-default bg-surface-1 text-foreground",
        className,
      )}
    >
      <ChevronLeft className="size-5" aria-hidden="true" />
    </button>
  );
}
