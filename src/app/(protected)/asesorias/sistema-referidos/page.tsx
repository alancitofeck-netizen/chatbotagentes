import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { isModuleEnabled } from "@/lib/settings/queries";
import { ModuleDisabledState } from "@/components/layout/ModuleDisabledState";
import { getReferralSessions, getReferralSystemGroup } from "@/lib/asesorias/referralSystem";
import { RealtimeRefresh } from "../RealtimeRefresh";
import { ReferralSessionsShell } from "./ReferralSessionsShell";

export const metadata: Metadata = { title: "Sistema de Referidos — Growth Link" };

/** Asesorías → Sistema de Referidos (0196): privado para las cuentas del grupo. */
export default async function SistemaReferidosPage() {
  const { workspaceId } = await requireActiveWorkspace();
  if (!(await isModuleEnabled(workspaceId, "asesorias"))) return <ModuleDisabledState moduleName="Asesorías" />;
  const group = await getReferralSystemGroup(workspaceId);
  if (!group) return <ModuleDisabledState moduleName="Sistema de Referidos" />;

  const sessions = await getReferralSessions(workspaceId);

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <RealtimeRefresh workspaceId={workspaceId} tables={["asesorias", "asesoria_referrals"]} />
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <Link href="/asesorias" className="mb-1 flex w-fit items-center gap-1.5 text-sm text-neutral-500 hover:text-foreground max-md:min-h-6">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Volver a Asesorías
        </Link>
        <h1 className="font-display text-[26px] leading-[32px] font-semibold tracking-[-0.02em] text-foreground">Sistema de Referidos</h1>
        <p className="text-sm text-neutral-500">Cierre con referidos: el prospecto te recomienda a quienes también les puede servir.</p>
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        <ReferralSessionsShell sessions={sessions} partnerCount={group.workspaceIds.length} />
      </div>
    </div>
  );
}
