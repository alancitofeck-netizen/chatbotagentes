import { PageHeader } from "@/components/ui/PageHeader";
import type { Metadata } from "next";
import { Workflow, Wrench } from "lucide-react";
import { OperacionesOverview } from "./OperacionesOverview";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";

export const metadata: Metadata = { title: "Operaciones — Growth Link" };

export default function OperacionesPage() {
  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy text-white">
          <Workflow className="size-5" aria-hidden="true" />
        </div>
        <div className="flex flex-col gap-1">
          <PageHeader icon={Wrench} title="Operaciones" description="Herramientas internas — solo owner/admin." titleAdornment={<ModuleHelp description="Este módulo centraliza dos herramientas internas de tu equipo." tourKey="operations-intro" />} />
        </div>
      </div>

      <OperacionesOverview />
    </div>
  );
}
