import type { ReactNode } from "react";
import { PoliciesSecondaryNav } from "./PoliciesSecondaryNav";

/** Hosts Pólizas' secondary nav (Cartera / Posibles Pólizas) — mismo patrón
 * que el resto de los módulos con sub-secciones (Inbox, antes Asesores). */
export default function PoliciesLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <PoliciesSecondaryNav />
      {children}
    </div>
  );
}
