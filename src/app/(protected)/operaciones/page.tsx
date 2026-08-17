import type { Metadata } from "next";
import { Workflow } from "lucide-react";
import { OperacionesOverview } from "./OperacionesOverview";

export const metadata: Metadata = { title: "Operaciones — Growth Link" };

export default function OperacionesPage() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-primary-600 text-white">
          <Workflow className="size-5" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Operaciones</h1>
          <p className="text-sm text-neutral-500">Herramientas internas — solo owner/admin.</p>
        </div>
      </div>

      <OperacionesOverview />
    </div>
  );
}
