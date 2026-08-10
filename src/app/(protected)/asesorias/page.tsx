import type { Metadata } from "next";
import { requireUser, requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { getAsesoriaListAction } from "@/lib/asesorias/actions";
import { AsesoriaStageOverview } from "./AsesoriaStageOverview";

export const metadata: Metadata = {
  title: "Asesorías — Growth Link",
};

export default async function AsesoriasPage() {
  const user = await requireUser();
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "asesorias");

  const asesorias = await getAsesoriaListAction();
  const lastActivityAt = asesorias.reduce<string | null>((latest, a) => {
    if (!latest) return a.updatedAt;
    return new Date(a.updatedAt) > new Date(latest) ? a.updatedAt : latest;
  }, null);
  const prospectosUnicos = new Set(asesorias.map((a) => a.contactId).filter(Boolean)).size;
  const advisorName = (user.user_metadata?.full_name as string | undefined) ?? null;

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Asesorías</h1>
        <p className="text-sm text-neutral-500">Gestioná tus reuniones comerciales — Presentación y Cita de Cierre, un mismo proceso.</p>
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        <AsesoriaStageOverview prospectosUnicos={prospectosUnicos} lastActivityAt={lastActivityAt} advisorName={advisorName} />
      </div>
    </div>
  );
}
