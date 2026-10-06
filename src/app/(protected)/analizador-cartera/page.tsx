import Link from "next/link";
import { Bot, Plus } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { isModuleEnabled } from "@/lib/settings/queries";
import { ModuleDisabledState } from "@/components/layout/ModuleDisabledState";
import { getInsuranceProvidersBoard } from "@/lib/insuranceProviders/queries";
import { getCarteraSummary, getCarteraDetailSummary } from "@/lib/portfolioAgent/queries";
import { PortfolioAgentShell } from "./PortfolioAgentShell";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";
import { PageHeader } from "@/components/ui/PageHeader";

/** "Analizador de Cartera" — dashboard nuevo sobre los MISMOS datos que
 * /aseguradoras (conexiones, pólizas sincronizadas): esa pantalla sigue
 * siendo donde se conecta/gestiona cada aseguradora, esta es la vista de
 * "qué dice mi cartera ahora mismo" + progreso de sync en vivo. Alcance de
 * esta pasada: conexión de portal + progreso + KPIs reales de cartera —
 * sin oportunidades/scoring de IA todavía (siguiente pasada, ver
 * PortfolioAgentShell). */
export default async function PortfolioAgentPage() {
  const { workspaceId } = await requireActiveWorkspace();
  if (!(await isModuleEnabled(workspaceId, "insurance_providers"))) return <ModuleDisabledState moduleName="Aseguradoras" />;

  const [providers, summary, detailSummary] = await Promise.all([
    getInsuranceProvidersBoard(workspaceId),
    getCarteraSummary(workspaceId),
    getCarteraDetailSummary(workspaceId),
  ]);
  const portalProvider = providers.find((p) => p.method === "portal") ?? null;

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="px-4 sm:px-6 lg:px-8">
        <PageHeader
          icon={Bot}
          title="Agente IA de Cartera"
          description="Sincronizá tu portal de pólizas y Growth Link organiza automáticamente tu cartera."
          titleAdornment={
            <>
              <Badge variant="accent">BETA</Badge>
              <ModuleHelp description="Sincronizá el portal de una aseguradora y Growth Link organiza automáticamente tu cartera — sin cargar nada a mano." tourKey="portfolio-agent-intro" />
            </>
          }
          actions={
        <Link
          href="/aseguradoras"
          data-tour="portfolio-agent.connect-header-link"
          className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent-500 px-4 py-2.5 text-[13px] font-medium text-white hover:bg-accent-600"
        >
          <Plus className="size-4" aria-hidden="true" />
          Conectar portal
        </Link>
          }
        />
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        <PortfolioAgentShell initialSummary={summary} detailSummary={detailSummary} portalProvider={portalProvider} />
      </div>
    </div>
  );
}
