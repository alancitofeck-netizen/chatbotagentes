import { PageHeader } from "@/components/ui/PageHeader";
import { Handshake } from "lucide-react";
import type { Metadata } from "next";
import { requireUser, requireActiveWorkspace } from "@/lib/auth/session";
import { isModuleEnabled } from "@/lib/settings/queries";
import { ModuleDisabledState } from "@/components/layout/ModuleDisabledState";
import { getAsesoriaListAction, getAsesoriaReferralActivityAction } from "@/lib/asesorias/actions";
import { AsesoriaStageOverview } from "./AsesoriaStageOverview";
import { RealtimeRefresh } from "./RealtimeRefresh";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";

export const metadata: Metadata = {
  title: "Asesorías — Growth Link",
};

export default async function AsesoriasPage() {
  const user = await requireUser();
  const { workspaceId } = await requireActiveWorkspace();
  if (!(await isModuleEnabled(workspaceId, "asesorias"))) return <ModuleDisabledState moduleName="Asesorías" />;

  const [asesorias, referralActivity] = await Promise.all([getAsesoriaListAction(), getAsesoriaReferralActivityAction()]);
  const lastActivityAt = asesorias.reduce<string | null>((latest, a) => {
    if (!latest) return a.updatedAt;
    return new Date(a.updatedAt) > new Date(latest) ? a.updatedAt : latest;
  }, null);
  const referidos = referralActivity.length;
  const advisorName = (user.user_metadata?.full_name as string | undefined) ?? null;

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <RealtimeRefresh workspaceId={workspaceId} tables={["asesorias", "asesoria_referrals"]} />
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <PageHeader icon={Handshake} title="Asesorías" description="Gestioná tus reuniones comerciales — Presentación y Cita de Cierre, un mismo proceso." titleAdornment={<ModuleHelp description="Gestioná tus reuniones comerciales — Presentación y Cita de Cierre, un mismo proceso guiado." tourKey="asesorias-intro" />} />
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        <AsesoriaStageOverview referidos={referidos} lastActivityAt={lastActivityAt} advisorName={advisorName} />
      </div>
    </div>
  );
}
