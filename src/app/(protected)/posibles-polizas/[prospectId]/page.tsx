import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getProspectDetail, getProspectNotes } from "@/lib/insuranceProspects/queries";
import { getDocumentsByRelatedAction } from "@/lib/documents/actions";
import { ProspectDetailShell } from "./ProspectDetailShell";

export const metadata: Metadata = {
  title: "Posible Póliza — Growth Link",
};

export default async function ProspectDetailPage({ params }: { params: Promise<{ prospectId: string }> }) {
  const { prospectId } = await params;
  const { workspaceId, role } = await requireActiveWorkspace();
  const canManage = role === "owner" || role === "admin";

  const prospect = await getProspectDetail(workspaceId, prospectId);
  if (!prospect) notFound();

  const [notes, members, documents] = await Promise.all([
    getProspectNotes(workspaceId, prospectId),
    getWorkspaceMembers(workspaceId),
    getDocumentsByRelatedAction("insurance_prospect", prospectId),
  ]);

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">{prospect.contactName}</h1>
        <p className="text-sm text-neutral-500">
          {prospect.origenAppNombre ? `Origen: ${prospect.origenAppNombre}` : "Posible póliza"}
        </p>
      </div>
      <ProspectDetailShell prospect={prospect} initialNotes={notes} initialDocuments={documents} members={members} canManage={canManage} />
    </div>
  );
}
