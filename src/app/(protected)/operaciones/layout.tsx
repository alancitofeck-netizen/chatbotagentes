import type { ReactNode } from "react";
import { forbidden } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";

/** Gate de todo el módulo Operaciones — mismo patrón que
 * classroom/admin/layout.tsx: solo owner/admin (o un platform admin
 * supervisando), a diferencia del resto de los módulos de "Clientes" que
 * son accesibles también a "agent". */
export default async function OperacionesLayout({ children }: { children: ReactNode }) {
  const { workspaceId, role, isSupervising } = await requireActiveWorkspace();
  if (role !== "owner" && role !== "admin" && !isSupervising) forbidden();
  await assertModuleEnabled(workspaceId, "operaciones");
  return children;
}
