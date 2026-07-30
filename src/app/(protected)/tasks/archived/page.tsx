import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getArchivedGroups } from "@/lib/tasks/groups/queries";
import { ArchivedGroupsList } from "./ArchivedGroupsList";

export const metadata: Metadata = {
  title: "Archivados — Growth Link",
};

export default async function ArchivedGroupsPage() {
  const { workspaceId } = await requireActiveWorkspace();
  const groups = await getArchivedGroups(workspaceId);

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <h1 className="text-[17px] font-semibold text-foreground">Grupos archivados</h1>
      {/* ArchivedGroupsList renders its own empty state — needed so the
         message also appears after the last item is optimistically removed
         client-side (Desarchivar), not only on a fresh server render. */}
      <ArchivedGroupsList initialGroups={groups} />
    </div>
  );
}
