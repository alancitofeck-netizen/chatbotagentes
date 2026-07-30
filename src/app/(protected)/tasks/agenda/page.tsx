import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getTasks } from "@/lib/tasks/queries";
import { getTaskGroups } from "@/lib/tasks/groups/queries";
import { AgendaList } from "./AgendaList";

export const metadata: Metadata = {
  title: "Agenda — Growth Link",
};

export default async function AgendaPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range: rangeParam } = await searchParams;
  const range = rangeParam === "week" ? "week" : "today";
  const { workspaceId } = await requireActiveWorkspace();

  const [tasks, groups] = await Promise.all([getTasks(workspaceId, { dueRange: range }), getTaskGroups(workspaceId)]);
  const groupsById = new Map(groups.map((g) => [g.id, g]));

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <h1 className="text-[17px] font-semibold text-foreground">{range === "today" ? "Hoy" : "Esta semana"}</h1>
      <AgendaList tasks={tasks} groupsById={groupsById} />
    </div>
  );
}
