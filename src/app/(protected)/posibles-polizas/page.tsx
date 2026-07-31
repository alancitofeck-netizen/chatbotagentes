import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getWorkspaceModuleStatus } from "@/lib/settings/queries";
import { getProspectsList } from "@/lib/insuranceProspects/queries";
import { PosiblesPolizasListShell } from "./PosiblesPolizasListShell";

export const metadata: Metadata = {
  title: "Posibles Pólizas — Growth Link",
};

export default async function PosiblesPolizasPage() {
  const { workspaceId } = await requireActiveWorkspace();
  const moduleStatus = await getWorkspaceModuleStatus(workspaceId);
  const enabled = moduleStatus.some((m) => m.moduleKey === "insurance_prospects" && m.enabled);

  const prospects = enabled ? await getProspectsList(workspaceId) : [];

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Posibles Pólizas</h1>
        <p className="text-sm text-neutral-500">
          Prospectos de seguro capturados automáticamente desde Mini Apps, calculadoras y formularios.
        </p>
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        <PosiblesPolizasListShell initialProspects={prospects} moduleEnabled={enabled} />
      </div>
    </div>
  );
}
