import { requireActiveWorkspace } from "@/lib/auth/session";
import { isModuleEnabled } from "@/lib/settings/queries";
import { ModuleDisabledState } from "@/components/layout/ModuleDisabledState";
import { getInsuranceProvidersBoard, summarizeInsuranceProviders } from "@/lib/insuranceProviders/queries";
import { AseguradorasShell } from "./AseguradorasShell";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";

export default async function AseguradorasPage() {
  const { workspaceId } = await requireActiveWorkspace();
  if (!(await isModuleEnabled(workspaceId, "insurance_providers"))) return <ModuleDisabledState moduleName="Aseguradoras" />;

  const providers = await getInsuranceProvidersBoard(workspaceId);
  const summary = summarizeInsuranceProviders(providers);

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">Centro de Integraciones</p>
        <div className="flex items-center gap-2">
          <h1 className="font-display text-[26px] leading-[32px] font-semibold tracking-[-0.02em] text-foreground">Conexión con Aseguradoras</h1>
          <ModuleHelp description="Acá podés consultar y gestionar la información relacionada con aseguradoras — conectá cada compañía para sincronizar tu cartera." tourKey="providers-intro" />
        </div>
        <p className="text-sm text-neutral-500">Conectá cada compañía y sincronizá tu cartera sin volver a cargar nada a mano.</p>
      </div>
      <AseguradorasShell initialProviders={providers} initialSummary={summary} />
    </div>
  );
}
