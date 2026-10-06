import type { Metadata } from "next";
import { CircleDollarSign } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { isModuleEnabled } from "@/lib/settings/queries";
import { ModuleDisabledState } from "@/components/layout/ModuleDisabledState";
import { getCollectionsListAction, getCollectionsKpisAction } from "@/lib/collections/actions";
import { CollectionsShell } from "./CollectionsShell";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";

export const metadata: Metadata = {
  title: "Cobranza — Growth Link",
};

export default async function CollectionsPage() {
  const { workspaceId } = await requireActiveWorkspace();
  if (!(await isModuleEnabled(workspaceId, "collections"))) return <ModuleDisabledState moduleName="Cobranza" />;

  const [items, kpis] = await Promise.all([getCollectionsListAction(), getCollectionsKpisAction()]);

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="px-4 sm:px-6 lg:px-8">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-success-strong">Seguimiento proactivo</p>
        <PageHeader
          icon={CircleDollarSign}
          title="Cobranza"
          description="A quién le toca pagar cada día — con 15 días de anticipación"
          actions={<ModuleHelp description="Desde acá podés controlar tus cobros y hacer seguimiento de pagos — quién debe pagar cada día, con anticipación." tourKey="collections-intro" />}
        />
      </div>
      <CollectionsShell initialItems={items} initialKpis={kpis} />
    </div>
  );
}
