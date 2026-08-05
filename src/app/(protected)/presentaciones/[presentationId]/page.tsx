import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { getPresentationByIdAction } from "@/lib/presentations/actions";
import { PresentationShell } from "./PresentationShell";

export const metadata: Metadata = {
  title: "Crear mi Presentación — Growth Link",
};

export default async function PresentationDetailPage({ params }: { params: Promise<{ presentationId: string }> }) {
  const { presentationId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "presentations");

  const presentation = await getPresentationByIdAction(presentationId);
  if (!presentation) notFound();

  return <PresentationShell presentation={presentation} />;
}
