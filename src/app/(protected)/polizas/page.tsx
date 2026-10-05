import type { Metadata } from "next";
import { FileCheck2 } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { isModuleEnabled } from "@/lib/settings/queries";
import { ModuleDisabledState } from "@/components/layout/ModuleDisabledState";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getPolicyBoardAction } from "@/lib/policies/actions";
import { PoliciesBoardShell } from "./PoliciesBoardShell";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";

export const metadata: Metadata = {
  title: "Pólizas — Growth Link",
};

export default async function PoliciesPage() {
  const { workspaceId } = await requireActiveWorkspace();
  if (!(await isModuleEnabled(workspaceId, "policies"))) return <ModuleDisabledState moduleName="Pólizas" />;

  const [board, members] = await Promise.all([getPolicyBoardAction(), getWorkspaceMembers(workspaceId)]);

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="px-4 sm:px-6 lg:px-8">
        <PageHeader
          icon={FileCheck2}
          title="Pólizas"
          description="Toda tu cartera en un solo lugar"
          actions={<ModuleHelp description="Acá podés consultar y administrar tus pólizas — buscá, filtrá, y abrí cualquiera para ver todo su detalle." tourKey="policies-list" />}
        />
      </div>
      <PoliciesBoardShell workspaceId={workspaceId} initialBoard={board} members={members} />
    </div>
  );
}
