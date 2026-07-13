import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getGlobalTools, getPrompts } from "@/lib/ai-settings/queries";
import { AiSettingsShell } from "./AiSettingsShell";

export const metadata: Metadata = {
  title: "Prompt Builder — Growth Link",
};

export default async function AiSettingsPage() {
  const { workspaceId } = await requireActiveWorkspace();

  const [prompts, tools] = await Promise.all([getPrompts(workspaceId, "crm"), getGlobalTools()]);

  return <AiSettingsShell initialModuleKey="crm" initialPrompts={prompts} tools={tools} />;
}
