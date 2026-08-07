import { requireActiveWorkspace } from "@/lib/auth/session";
import { ensureAutomationTemplates } from "@/lib/automationTemplates/queries";
import { AutomationsShell } from "./AutomationsShell";

export default async function AutomatizacionesPage() {
  const { workspaceId } = await requireActiveWorkspace();
  const automations = await ensureAutomationTemplates(workspaceId);

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">Sin armar nada</p>
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Automatizaciones</h1>
        <p className="text-sm text-neutral-500">Automatizaciones inteligentes para ahorrar tiempo.</p>
        <p className="text-xs text-neutral-400">Activa únicamente las automatizaciones que quieras utilizar.</p>
      </div>
      <AutomationsShell initialAutomations={automations} />
    </div>
  );
}
