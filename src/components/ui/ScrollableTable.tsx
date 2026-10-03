import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Contiene una <table> ancha: en pantallas chicas el scroll horizontal queda
 * dentro del propio contenedor, nunca en la página entera. Sin efecto visual
 * en escritorio (el contenedor ya ocupa su ancho). */
export function ScrollableTable({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("w-full max-w-full overflow-x-auto overscroll-x-contain", className)}>{children}</div>;
}
