import type { ReactNode } from "react";
import { AdvisorsSecondaryNav } from "./AdvisorsSecondaryNav";

/** Hosts Asesores' secondary nav (Tablero / Posibles Pólizas) — same nested-
 * layout idea as src/app/(protected)/inbox/layout.tsx, but simpler: Asesores'
 * pages are plain scrolling content (not Inbox's fixed-height chat panels),
 * so this just stacks the nav above `children` and lets the existing
 * `<main overflow-y-auto>` in (protected)/layout.tsx keep doing the
 * scrolling — no extra height/overflow wrapper needed here. */
export default function AdvisorsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <AdvisorsSecondaryNav />
      {children}
    </div>
  );
}
