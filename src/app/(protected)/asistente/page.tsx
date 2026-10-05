import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { isModuleEnabled } from "@/lib/settings/queries";
import { ModuleDisabledState } from "@/components/layout/ModuleDisabledState";
import { getOrCreateActiveConversationAction, getConversationMessagesAction, getAssistantDashboardAction } from "@/lib/assistant/actions";
import { AssistantShell } from "./AssistantShell";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";

export const metadata: Metadata = {
  title: "Asistente IA — Growth Link",
};

export default async function AssistantPage() {
  const { workspaceId } = await requireActiveWorkspace();
  if (!(await isModuleEnabled(workspaceId, "ai_assistant"))) return <ModuleDisabledState moduleName="Asistente IA" />;

  const { id: conversationId } = await getOrCreateActiveConversationAction();
  const [messages, dashboard] = await Promise.all([getConversationMessagesAction(conversationId), getAssistantDashboardAction()]);

  return (
    <div className="flex h-[calc(100vh-4rem)] max-md:h-[calc(100dvh-4rem)] flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Asistente IA</h1>
          <ModuleHelp description="Pedile ayuda para analizar información, resolver dudas o trabajar con tus datos, en lenguaje natural." tourKey="assistant-intro" />
        </div>
        <p className="text-sm text-neutral-500">Tu copiloto dentro del CRM — pedile cosas en lenguaje natural</p>
      </div>
      <AssistantShell conversationId={conversationId} initialMessages={messages} initialDashboard={dashboard} />
    </div>
  );
}
