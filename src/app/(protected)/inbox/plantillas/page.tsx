import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getTemplateList } from "@/lib/templates/queries";
import { getWhatsAppIntegration } from "@/lib/integrations/queries";
import { TemplatesShell } from "./TemplatesShell";

export const metadata: Metadata = {
  title: "Plantillas — Growth Link",
};

export default async function PlantillasPage() {
  const { workspaceId, role } = await requireActiveWorkspace();
  const [templates, integration] = await Promise.all([
    getTemplateList(workspaceId),
    getWhatsAppIntegration(workspaceId),
  ]);

  return (
    <TemplatesShell
      initialTemplates={templates}
      canManage={role === "owner" || role === "admin"}
      hasYCloudConnection={Boolean(integration)}
    />
  );
}
