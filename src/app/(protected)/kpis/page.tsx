import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getTeams } from "@/lib/agents/queries";
import { hasAnyKpiSetterSheet } from "@/lib/kpis/queries";
import { KpisSection } from "./KpisSection";
import { KpisTabStrip } from "./KpisTabStrip";
import { AgendaKpisSection } from "./AgendaKpisSection";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";
import { PageHeader } from "@/components/ui/PageHeader";
import { Gauge } from "lucide-react";

export const metadata: Metadata = {
  title: "KPIs — Growth Link",
};

export default async function KpisPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { workspaceId, role } = await requireActiveWorkspace();
  const { tab } = await searchParams;
  const isManager = role === "owner" || role === "admin";

  const [teams, hasConnection] = await Promise.all([
    getTeams(workspaceId),
    hasAnyKpiSetterSheet(workspaceId),
  ]);

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="px-4 sm:px-6 lg:px-8">
        <PageHeader
          back
          icon={Gauge}
          title="KPIs"
          description={tab === "agendas" ? "Rendimiento de setters y asesores, a partir de las citas reales." : "Números de tus setters, sincronizados desde Google Sheets."}
          help={<ModuleHelp description="Los KPIs te muestran cómo está funcionando tu actividad — leads, contactos, citas y calificadas, sin abrir tu hoja." tourKey="kpis-intro" />}
        />
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        <KpisTabStrip />
      </div>
      {tab === "agendas" ? <AgendaKpisSection isManager={isManager} /> : <KpisSection hasConnection={hasConnection} teams={teams} />}
    </div>
  );
}
