import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getTeams } from "@/lib/agents/queries";
import { hasAnyKpiSetterSheet } from "@/lib/kpis/queries";
import { KpisSection } from "./KpisSection";

export const metadata: Metadata = {
  title: "KPIs — Growth Link",
};

export default async function KpisPage() {
  const { workspaceId } = await requireActiveWorkspace();

  const [teams, hasConnection] = await Promise.all([
    getTeams(workspaceId),
    hasAnyKpiSetterSheet(workspaceId),
  ]);

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">KPIs</h1>
        <p className="text-sm text-neutral-500">Números de tus setters, sincronizados desde Google Sheets.</p>
      </div>
      <KpisSection hasConnection={hasConnection} teams={teams} />
    </div>
  );
}
