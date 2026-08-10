import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { getAsesoriaReferralsAction } from "@/lib/asesorias/actions";
import { ReferidosShell } from "./ReferidosShell";
import { RealtimeRefresh } from "../RealtimeRefresh";

export const metadata: Metadata = {
  title: "Referidos — Growth Link",
};

export default async function ReferidosPage() {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "asesorias");

  const referrals = await getAsesoriaReferralsAction();

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <RealtimeRefresh workspaceId={workspaceId} tables={["asesoria_referrals"]} />
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <Link href="/asesorias/presentacion" className="mb-1 flex w-fit items-center gap-1.5 text-sm text-neutral-500 hover:text-foreground">
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Volver a Presentación
        </Link>
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Referidos</h1>
        <p className="text-sm text-neutral-500">Personas referidas por los prospectos durante las asesorías.</p>
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        <ReferidosShell initialReferrals={referrals} />
      </div>
    </div>
  );
}
