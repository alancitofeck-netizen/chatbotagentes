import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getMiniAppDetail, getMiniAppLeads, getMiniAppVisitsCount } from "@/lib/miniApps/queries";
import { getContentCalendarData } from "@/lib/miniApps/contentCalendar";
import { getOwnMiniAppAccessRole } from "@/lib/miniApps/access";
import { MiniAppDetailShell } from "./MiniAppDetailShell";

export const metadata: Metadata = {
  title: "Mini App — Growth Link",
};

export default async function MiniAppDetailPage({ params }: { params: Promise<{ miniAppId: string }> }) {
  const { miniAppId } = await params;
  const { workspaceId, role } = await requireActiveWorkspace();
  const canManage = role === "owner" || role === "admin";

  const miniApp = await getMiniAppDetail(workspaceId, miniAppId);
  if (!miniApp) notFound();

  const [leads, members, visitsCount, contentCalendar, ownAccessRole] = await Promise.all([
    getMiniAppLeads(workspaceId, miniAppId),
    getWorkspaceMembers(workspaceId),
    getMiniAppVisitsCount(workspaceId, miniAppId),
    miniApp.templateKey === "content_calendar" ? getContentCalendarData(miniAppId) : Promise.resolve(null),
    miniApp.isPrivate ? getOwnMiniAppAccessRole(miniAppId) : Promise.resolve(null),
  ]);
  const canEditContent = canManage || ownAccessRole === "editor";

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <h1 className="flex items-center gap-2 text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">
          {miniApp.isPrivate && <span title="Mini App privada">🔒</span>}
          {miniApp.name}
        </h1>
        {miniApp.description && <p className="text-sm text-neutral-500">{miniApp.description}</p>}
      </div>
      <MiniAppDetailShell
        miniApp={miniApp}
        initialLeads={leads}
        members={members}
        visitsCount={visitsCount}
        canManage={canManage}
        contentCalendar={contentCalendar}
        canEditContent={canEditContent}
      />
    </div>
  );
}
