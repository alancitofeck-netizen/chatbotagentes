import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { isModuleEnabled } from "@/lib/settings/queries";
import { ModuleDisabledState } from "@/components/layout/ModuleDisabledState";
import { CitaDeCierrePanel } from "../CitaDeCierrePanel";

export const metadata: Metadata = {
  title: "Cita de Cierre — Growth Link",
};

export default async function AsesoriasCierrePage() {
  const { workspaceId } = await requireActiveWorkspace();
  if (!(await isModuleEnabled(workspaceId, "asesorias"))) return <ModuleDisabledState moduleName="Asesorías" />;

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <Link href="/asesorias" className="mb-1 flex w-fit items-center gap-1.5 text-sm text-neutral-500 hover:text-foreground max-md:min-h-6">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Volver a Asesorías
        </Link>
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Cita de Cierre</h1>
        <p className="text-sm text-neutral-500">Segunda reunión para avanzar con el cierre del prospecto.</p>
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        <CitaDeCierrePanel />
      </div>
    </div>
  );
}
