import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { getAsesoriaListAction } from "@/lib/asesorias/actions";
import { AsesoriasListShell } from "./AsesoriasListShell";

export const metadata: Metadata = {
  title: "Asesorías — Growth Link",
};

export default async function AsesoriasPage() {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "asesorias");

  const asesorias = await getAsesoriaListAction();

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Asesorías</h1>
        <p className="text-sm text-neutral-500">Reuniones guiadas con el prospecto, en vivo — se guardan solas mientras avanzás.</p>
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        <AsesoriasListShell initialAsesorias={asesorias} />
      </div>
    </div>
  );
}
