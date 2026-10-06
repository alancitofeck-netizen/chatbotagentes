import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { isModuleEnabled } from "@/lib/settings/queries";
import { ModuleDisabledState } from "@/components/layout/ModuleDisabledState";
import { getPresentationByIdAction } from "@/lib/presentations/actions";
import { PresentationShell } from "./PresentationShell";

export const metadata: Metadata = {
  title: "Crear mi Presentación — Growth Link",
};

export default async function PresentationDetailPage({ params }: { params: Promise<{ presentationId: string }> }) {
  const { presentationId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  if (!(await isModuleEnabled(workspaceId, "presentations"))) return <ModuleDisabledState moduleName="Presentaciones" />;

  const presentation = await getPresentationByIdAction(presentationId);
  if (!presentation) notFound();

  return <PresentationShell presentation={presentation} />;
}
