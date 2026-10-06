import { PageHeader } from "@/components/ui/PageHeader";
import { Projector } from "lucide-react";
import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { isModuleEnabled } from "@/lib/settings/queries";
import { ModuleDisabledState } from "@/components/layout/ModuleDisabledState";
import { getPresentationListAction, getPresentationsKpisAction } from "@/lib/presentations/actions";
import { PresentationsShell } from "./PresentationsShell";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";

export const metadata: Metadata = {
  title: "Crear mi Presentación — Growth Link",
};

export default async function PresentationsPage() {
  const { workspaceId } = await requireActiveWorkspace();
  if (!(await isModuleEnabled(workspaceId, "presentations"))) return <ModuleDisabledState moduleName="Presentaciones" />;

  const [items, kpis] = await Promise.all([getPresentationListAction(), getPresentationsKpisAction()]);

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">✨ Potenciado con IA</p>
        <PageHeader icon={Projector} title="Crear mi Presentación" description="Generá presentaciones profesionales potenciadas con IA para mostrar a tus clientes." titleAdornment={<ModuleHelp description="Creá tu presentación profesional paso a paso — información, fotos, servicios, y la IA arma el contenido por vos." tourKey="presentations-intro" />} />
      </div>
      <PresentationsShell initialItems={items} initialKpis={kpis} />
    </div>
  );
}
