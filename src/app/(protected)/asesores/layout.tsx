import type { ReactNode } from "react";
import { Users, ShieldAlert } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getAgencyWorkspaceAccessForCurrentUser } from "@/lib/auth/roles";
import { getWorkspaceModuleStatus } from "@/lib/settings/queries";
import { EmptyState } from "@/components/ui/EmptyState";
import { TabLink } from "@/components/ui/Tabs";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";

/** Header + tabs de nivel LISTADO (Resumen | Performance | Agendas |
 * Operaciones) — mismo patrón que
 * asesores/[clientId]/layout.tsx para la ficha (gate + header/tabs acá,
 * cada page.tsx re-resuelve su propio workspaceId, mismo criterio ya
 * establecido en toda la sesión). "Resumen" es exactamente el contenido que
 * ya existía en asesores/page.tsx, sin cambios — "Performance" es nuevo. */
export default async function AsesoresLayout({ children }: { children: ReactNode }) {
  await requireActiveWorkspace();
  const agencyWorkspaceId = await getAgencyWorkspaceAccessForCurrentUser();

  const header = (
    <div className="flex items-center gap-3 px-4 sm:px-6 lg:px-8">
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent-500 to-primary-600 text-white">
        <Users className="size-5" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Asesores</h1>
          <ModuleHelp description="Desde acá podés administrar los asesores de tu agencia — su listado, perfil y actividad." tourKey="advisors-admin-intro" />
        </div>
        <p className="text-sm text-neutral-500">Gestioná y monitoreá las cuentas de asesores de Growth Link.</p>
      </div>
    </div>
  );

  if (!agencyWorkspaceId) {
    return (
      <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
        {header}
        <div className="px-4 sm:px-6 lg:px-8">
          <EmptyState icon={ShieldAlert} title="Acceso restringido" description="Este módulo es solo para owner/admin del workspace de la agencia." />
        </div>
      </div>
    );
  }

  const moduleStatus = await getWorkspaceModuleStatus(agencyWorkspaceId);
  const moduleEnabled = moduleStatus.some((m) => m.moduleKey === "asesores" && m.enabled);

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      {header}
      {moduleEnabled && (
        <div className="px-4 sm:px-6 lg:px-8">
          <div role="tablist" className="flex gap-5 border-b border-border-default">
            <TabLink href="/asesores" exact>
              Resumen
            </TabLink>
            <TabLink href="/asesores/performance">Performance</TabLink>
            <TabLink href="/asesores/agendas">Agendas</TabLink>
            <TabLink href="/asesores/operaciones">Operaciones</TabLink>
          </div>
        </div>
      )}
      <div className="px-4 sm:px-6 lg:px-8">{children}</div>
    </div>
  );
}
