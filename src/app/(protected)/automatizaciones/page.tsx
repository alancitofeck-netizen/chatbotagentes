import { requireActiveWorkspace } from "@/lib/auth/session";
import { getAutomationsBoard, getAutomationStats } from "@/lib/automationTemplates/queries";
import { AutomationsShell } from "./AutomationsShell";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";

export default async function AutomatizacionesPage() {
  const { workspaceId } = await requireActiveWorkspace();
  const automations = await getAutomationsBoard(workspaceId);
  const stats = await getAutomationStats(workspaceId, automations);

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">Biblioteca de automatizaciones</p>
        <div className="flex items-center gap-2">
          <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Automatizaciones</h1>
          <ModuleHelp description="Las automatizaciones permiten que Growth Link haga tareas automáticamente por vos: cuando pasa algo (un mensaje, un lead nuevo), ejecuta una acción sola." tourKey="automations-intro" />
        </div>
        <p className="text-sm text-neutral-500">Automatizaciones inteligentes para ahorrar tiempo.</p>
        <p className="text-xs text-neutral-400">Activa únicamente las automatizaciones que quieras utilizar.</p>
      </div>
      <AutomationsShell initial={{ automations, stats }} />
    </div>
  );
}
