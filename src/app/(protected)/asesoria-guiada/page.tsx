import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { getAdvisorySessionListAction } from "@/lib/advisorySessions/actions";
import { AdvisorySessionsListShell } from "./AdvisorySessionsListShell";

export const metadata: Metadata = {
  title: "Asesoría Guiada — Growth Link",
};

export default async function AdvisorySessionsPage() {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "advisory_sessions");

  const sessions = await getAdvisorySessionListAction();

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Asesoría Guiada</h1>
        <p className="text-sm text-neutral-500">Cuestionario inteligente para descubrir necesidades y recomendar productos, en vivo durante la reunión.</p>
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        <AdvisorySessionsListShell initialSessions={sessions} />
      </div>
    </div>
  );
}
