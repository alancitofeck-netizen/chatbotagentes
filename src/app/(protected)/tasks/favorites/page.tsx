import type { Metadata } from "next";
import { Star } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { EmptyState } from "@/components/ui/EmptyState";
import { getFavoriteGroups, getGroupStatsBatch } from "@/lib/tasks/groups/queries";
import { GroupCard } from "../TasksWorkspaceHome";

export const metadata: Metadata = {
  title: "Favoritos — Growth Link",
};

export default async function FavoriteGroupsPage() {
  const { workspaceId } = await requireActiveWorkspace();
  const groups = await getFavoriteGroups(workspaceId);
  const statsByGroup = await getGroupStatsBatch(
    workspaceId,
    groups.map((g) => g.id),
  );

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <h1 className="text-[17px] font-semibold text-foreground">Favoritos</h1>
      {groups.length === 0 ? (
        <EmptyState icon={Star} title="Sin grupos favoritos" description="Marcá un grupo como favorito desde su propia página para verlo acá." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <GroupCard
              key={group.id}
              group={group}
              stats={statsByGroup.get(group.id) ?? { pending: 0, inProgress: 0, completed: 0, total: 0, progressPct: 0 }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
