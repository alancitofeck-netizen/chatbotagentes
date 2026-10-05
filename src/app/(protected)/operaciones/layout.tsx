import type { ReactNode } from "react";
import { forbidden } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { isModuleEnabled } from "@/lib/settings/queries";
import { ModuleDisabledState } from "@/components/layout/ModuleDisabledState";

/** Gate de todo el módulo Operaciones — mismo patrón que
 * classroom/admin/layout.tsx: solo owner/admin (o un platform admin
 * supervisando), a diferencia del resto de los módulos de "Clientes" que
 * son accesibles también a "agent". */
export default async function OperacionesLayout({ children }: { children: ReactNode }) {
  const { workspaceId, role, isSupervising } = await requireActiveWorkspace();
  if (role !== "owner" && role !== "admin" && !isSupervising) forbidden();
  if (!(await isModuleEnabled(workspaceId, "operaciones"))) return <ModuleDisabledState moduleName="Operaciones" />;
  return children;
}
