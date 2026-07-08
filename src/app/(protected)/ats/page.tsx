import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getVacancies } from "@/lib/ats/queries";
import { VacancyList } from "./VacancyList";

export const metadata: Metadata = {
  title: "ATS — Growth Link",
};

export default async function AtsPage() {
  const { workspaceId } = await requireActiveWorkspace();
  const vacancies = await getVacancies(workspaceId);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">ATS</h1>
        <p className="text-sm text-neutral-500">Vacantes abiertas y su tablero de candidatos.</p>
      </div>

      <VacancyList vacancies={vacancies} />
    </div>
  );
}
