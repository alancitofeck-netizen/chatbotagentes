import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getVacancies } from "@/lib/ats/queries";
import { getWorkspaceModuleStatus } from "@/lib/settings/queries";
import { CrmAtsTabStrip } from "../crm/CrmAtsTabStrip";
import { VacancyList } from "./VacancyList";

export const metadata: Metadata = {
  title: "ATS — Growth Link",
};

/** ATS kept its own route (didn't move to /crm/ats — see CrmAtsTabStrip.tsx
 * for why) but renders the same tab strip as /crm so the two read as one
 * area, reached now only via CRM's "ATS" tab (Sidebar.tsx no longer lists
 * ATS as its own top-level item). */
export default async function AtsPage() {
  const { workspaceId } = await requireActiveWorkspace();
  const [vacancies, moduleStatus] = await Promise.all([
    getVacancies(workspaceId),
    getWorkspaceModuleStatus(workspaceId),
  ]);
  const atsEnabled = moduleStatus.some((m) => m.moduleKey === "ats" && m.enabled);

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="px-4 sm:px-6 lg:px-8">
        <CrmAtsTabStrip atsEnabled={atsEnabled} />
      </div>
      <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">ATS</h1>
          <p className="text-sm text-neutral-500">Vacantes abiertas y su tablero de candidatos.</p>
        </div>

        <VacancyList vacancies={vacancies} />
      </div>
    </div>
  );
}
