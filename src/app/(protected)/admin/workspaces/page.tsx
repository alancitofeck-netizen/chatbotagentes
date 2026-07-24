import type { Metadata } from "next";
import { forbidden } from "next/navigation";
import { Building2 } from "lucide-react";
import { isPlatformAdmin } from "@/lib/auth/roles";
import { getAllWorkspacesForSupervision } from "@/lib/platform/queries";
import { EmptyState } from "@/components/ui/EmptyState";
import { WorkspaceSupervisionTable } from "./WorkspaceSupervisionTable";

export const metadata: Metadata = {
  title: "Panel de supervisión — Growth Link",
};

/** Owner global only ("Global Owner" per the role-permissions spec) — every
 * other account, including workspace owners/admins, must get a real 403 for
 * a typed-in /admin/workspaces URL, not just a hidden nav entry
 * (UserMenu.tsx only renders the link when isPlatformAdmin). */
export default async function AdminWorkspacesPage() {
  if (!(await isPlatformAdmin())) forbidden();

  const workspaces = await getAllWorkspacesForSupervision();

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">
          Panel de supervisión
        </h1>
        <p className="text-sm text-neutral-500">
          Todos los Workspaces de Growth Link — cada uno es independiente, &ldquo;Ver Dashboard&rdquo; entra en modo
          supervisor (solo lectura).
        </p>
      </div>

      {workspaces.length === 0 ? (
        <EmptyState icon={Building2} title="Todavía no hay Workspaces" description="Ningún usuario se registró aún." />
      ) : (
        <WorkspaceSupervisionTable workspaces={workspaces} />
      )}
    </div>
  );
}
