import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getAutomationList } from "@/lib/automations/queries";
import { AutomationsShell } from "./AutomationsShell";

export const metadata: Metadata = {
  title: "Automatizaciones — Growth Link",
};

export default async function AutomationsPage() {
  const { workspaceId } = await requireActiveWorkspace();
  const automations = await getAutomationList(workspaceId);

  return <AutomationsShell initialAutomations={automations} />;
}
