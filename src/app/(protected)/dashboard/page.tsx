import type { Metadata } from "next";
import { requireUser, requireActiveWorkspace } from "@/lib/auth/session";
import {
  getDashboardKpis,
  getActivitySeries,
  getRecentConversations,
  getPendingTasks,
} from "@/lib/dashboard/queries";
import { KpiCards } from "./KpiCards";
import { ActivityChart } from "./ActivityChart";
import { RecentConversations } from "./RecentConversations";
import { PendingTasks } from "./PendingTasks";

export const metadata: Metadata = {
  title: "Dashboard — Growth Link",
};

export default async function DashboardPage() {
  const user = await requireUser();
  const { workspaceId } = await requireActiveWorkspace();
  const firstName = ((user.user_metadata?.full_name as string | undefined) ?? "").split(" ")[0];

  const [kpis, activity, conversations, tasks] = await Promise.all([
    getDashboardKpis(workspaceId),
    getActivitySeries(workspaceId, "7d"),
    getRecentConversations(workspaceId),
    getPendingTasks(workspaceId),
  ]);

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground text-balance">
          {firstName ? `Hola, ${firstName}` : "Hola de nuevo"}
        </h1>
        <p className="text-sm text-neutral-500">Esto es lo que está pasando en tu workspace hoy.</p>
      </div>

      <KpiCards kpis={kpis} />
      <ActivityChart initialData={activity} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <RecentConversations conversations={conversations} />
        <PendingTasks tasks={tasks} />
      </div>
    </div>
  );
}
