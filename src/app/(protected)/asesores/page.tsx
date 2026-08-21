import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getAgencyWorkspaceAccessForCurrentUser } from "@/lib/auth/roles";
import { getWorkspaceModuleStatus } from "@/lib/settings/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getClientsList } from "@/lib/clients/queries";
import { ClientesListShell } from "./ClientesListShell";

export const metadata: Metadata = {
  title: "Asesores — Growth Link",
};

/** "Resumen" (tab por defecto de Asesores) — contenido sin cambios respecto
 * a como era esta page.tsx antes de sumar el tab strip (ver layout.tsx, que
 * ahora pone el header y ya gatea el acceso — si no sos owner/admin real de
 * la agencia esta page.tsx ni se ejecuta). */
export default async function AsesoresPage() {
  await requireActiveWorkspace();
  const agencyWorkspaceId = await getAgencyWorkspaceAccessForCurrentUser();
  if (!agencyWorkspaceId) return null;

  const moduleStatus = await getWorkspaceModuleStatus(agencyWorkspaceId);
  const moduleEnabled = moduleStatus.some((m) => m.moduleKey === "asesores" && m.enabled);

  const [clients, members] = moduleEnabled ? await Promise.all([getClientsList(agencyWorkspaceId), getWorkspaceMembers(agencyWorkspaceId)]) : [[], []];

  return <ClientesListShell initialClients={clients} members={members} moduleEnabled={moduleEnabled} />;
}
