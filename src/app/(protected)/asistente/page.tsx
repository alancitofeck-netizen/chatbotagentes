import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { getOrCreateActiveConversationAction, getConversationMessagesAction, getAssistantDashboardAction } from "@/lib/assistant/actions";
import { AssistantShell } from "./AssistantShell";

export const metadata: Metadata = {
  title: "Asistente IA — Growth Link",
};

export default async function AssistantPage() {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "ai_assistant");

  const { id: conversationId } = await getOrCreateActiveConversationAction();
  const [messages, dashboard] = await Promise.all([getConversationMessagesAction(conversationId), getAssistantDashboardAction()]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Asistente IA</h1>
        <p className="text-sm text-neutral-500">Tu copiloto dentro del CRM — pedile cosas en lenguaje natural</p>
      </div>
      <AssistantShell conversationId={conversationId} initialMessages={messages} initialDashboard={dashboard} />
    </div>
  );
}
