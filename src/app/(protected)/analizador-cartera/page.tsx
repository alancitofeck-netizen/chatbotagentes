import { requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { getInsuranceProvidersBoard } from "@/lib/insuranceProviders/queries";
import { getCarteraSummary } from "@/lib/portfolioAgent/queries";
import { PortfolioAgentShell } from "./PortfolioAgentShell";

/** "Analizador de Cartera" — dashboard nuevo sobre los MISMOS datos que
 * /aseguradoras (conexiones, pólizas sincronizadas): esa pantalla sigue
 * siendo donde se conecta/gestiona cada aseguradora, esta es la vista de
 * "qué dice mi cartera ahora mismo" + progreso de sync en vivo. Alcance de
 * esta pasada: conexión de portal + progreso + KPIs reales de cartera —
 * sin oportunidades/scoring de IA todavía (siguiente pasada). */
export default async function PortfolioAgentPage() {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "insurance_providers");

  const [providers, summary] = await Promise.all([getInsuranceProvidersBoard(workspaceId), getCarteraSummary(workspaceId)]);
  const portalProvider = providers.find((p) => p.method === "portal") ?? null;

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">Agente IA de Cartera</p>
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Analizador de Cartera</h1>
        <p className="text-sm text-neutral-500">Sincroniza tu portal de pólizas y Growth Link organiza automáticamente tu cartera.</p>
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        <PortfolioAgentShell initialSummary={summary} portalProvider={portalProvider} />
      </div>
    </div>
  );
}
