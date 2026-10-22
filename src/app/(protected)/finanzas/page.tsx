import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { isModuleEnabled } from "@/lib/settings/queries";
import { ModuleDisabledState } from "@/components/layout/ModuleDisabledState";
import { getFinanceItems, getFinanceSettings } from "@/lib/finance/queries";
import { FinanzasShell } from "./FinanzasShell";

export const metadata: Metadata = {
  title: "Finanzas — Growth Link",
};

/** Finanzas reemplaza a Cobranza (mismo module_key "collections"): gastos, calendario, cobros
 * (pólizas + asesorías + ventas) y resumen. /cobranza redirige acá (next.config.ts). */
export default async function FinanzasPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const { workspaceId } = await requireActiveWorkspace();
  if (!(await isModuleEnabled(workspaceId, "collections"))) return <ModuleDisabledState moduleName="Finanzas" />;

  const [{ payment }, items] = await Promise.all([searchParams, getFinanceItems(workspaceId)]);
  const settings = await getFinanceSettings(workspaceId, items);

  return (
    <div className="py-2 sm:py-4">
      <FinanzasShell initialItems={items} initialSettings={settings} initialPaymentId={payment ?? null} />
    </div>
  );
}
