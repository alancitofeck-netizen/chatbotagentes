import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { getAdvisorySessionByIdAction } from "@/lib/advisorySessions/actions";
import { AdvisorySessionShell } from "./AdvisorySessionShell";

export const metadata: Metadata = {
  title: "Asesoría Guiada — Growth Link",
};

export default async function AdvisorySessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "advisory_sessions");

  const session = await getAdvisorySessionByIdAction(sessionId);
  if (!session) notFound();

  return <AdvisorySessionShell session={session} />;
}
