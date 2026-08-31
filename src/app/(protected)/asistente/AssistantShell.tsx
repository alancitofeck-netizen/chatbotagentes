"use client";

import type { AssistantMessageView, AssistantDashboard } from "@/lib/assistant/actions";
import { ChatColumn } from "./ChatColumn";
import { SmartCardsColumn } from "./SmartCardsColumn";
import { useAutoStartTour } from "@/components/onboarding/useAutoStartTour";

export function AssistantShell({
  conversationId,
  initialMessages,
  initialDashboard,
}: {
  conversationId: string;
  initialMessages: AssistantMessageView[];
  initialDashboard: AssistantDashboard;
}) {
  useAutoStartTour("assistant-intro");
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 px-4 sm:px-6 lg:grid-cols-[1fr_380px] lg:px-8">
      <ChatColumn conversationId={conversationId} initialMessages={initialMessages} />
      <SmartCardsColumn dashboard={initialDashboard} />
    </div>
  );
}
