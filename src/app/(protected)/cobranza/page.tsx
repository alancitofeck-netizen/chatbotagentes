import type { Metadata } from "next";
import { CircleDollarSign } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { isModuleEnabled } from "@/lib/settings/queries";
import { ModuleDisabledState } from "@/components/layout/ModuleDisabledState";
import { getGastosTabData } from "@/lib/finanzas/queries";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";
import { FinanzasShell } from "./FinanzasShell";

export const metadata: Metadata = {
  title: "Finanzas — Growth Link",
};

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function FinanzasPage() {
  const { workspaceId } = await requireActiveWorkspace();
  if (!(await isModuleEnabled(workspaceId, "collections"))) return <ModuleDisabledState moduleName="Finanzas" />;

  const month = currentMonth();
  const initialGastos = await getGastosTabData(workspaceId, { month });

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="px-4 sm:px-6 lg:px-8">
        <PageHeader
          icon={CircleDollarSign}
          title="Finanzas"
          description="Tus gastos, lo que te deben y lo que tenés que pagar — todo en un solo lugar"
          actions={<ModuleHelp description="Registrá lo que te deben (pólizas, asesorías, ventas) y lo que gastás (herramientas, cursos, otros gastos). Todo queda guardado en el CRM, con calendario y vencimientos." tourKey="collections-intro" />}
        />
      </div>
      <div className="px-4 sm:px-6 lg:px-8">
        <FinanzasShell initialMonth={month} initialGastos={initialGastos} />
      </div>
    </div>
  );
}
