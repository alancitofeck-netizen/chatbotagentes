import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getMiniAppDetail, getMiniAppLeads, getMiniAppVisitsCount } from "@/lib/miniApps/queries";
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

  const [leads, members, visitsCount] = await Promise.all([
    getMiniAppLeads(workspaceId, miniAppId),
    getWorkspaceMembers(workspaceId),
    getMiniAppVisitsCount(workspaceId, miniAppId),
  ]);

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">{miniApp.name}</h1>
        {miniApp.description && <p className="text-sm text-neutral-500">{miniApp.description}</p>}
      </div>
      <MiniAppDetailShell miniApp={miniApp} initialLeads={leads} members={members} visitsCount={visitsCount} canManage={canManage} />
    </div>
  );
}
