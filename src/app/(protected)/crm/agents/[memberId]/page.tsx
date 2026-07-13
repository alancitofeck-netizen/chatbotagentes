import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getAgentDetail } from "@/lib/agents/queries";
import { AgentProfileView } from "./AgentProfileView";

export const metadata: Metadata = {
  title: "Agente — Growth Link",
};

export default async function AgentProfilePage({ params }: { params: Promise<{ memberId: string }> }) {
  const { memberId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  const agent = await getAgentDetail(workspaceId, memberId);

  if (!agent) notFound();

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div>
        <Link href="/crm" className="flex w-fit items-center gap-1 text-xs text-neutral-500 hover:text-foreground">
          <ArrowLeft size={13} /> CRM
        </Link>
        <h1 className="mt-1 text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">
          {agent.fullName}
        </h1>
        <p className="text-sm text-neutral-500">{agent.title || "Sin cargo"}</p>
      </div>
      <AgentProfileView agent={agent} />
    </div>
  );
}
