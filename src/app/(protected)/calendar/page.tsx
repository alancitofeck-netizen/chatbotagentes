import type { Metadata } from "next";
import { getCurrentMemberId, requireActiveWorkspace } from "@/lib/auth/session";
import { getCalendarEvents } from "@/lib/calendar/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getConversationOptions } from "@/lib/tasks/queries";
import { getOpportunityOptions } from "@/lib/crm/queries";
import { addDays, getMonday } from "@/lib/calendar/week";
import { CalendarShell } from "./CalendarShell";

export const metadata: Metadata = {
  title: "Calendario — Growth Link",
};

export default async function CalendarPage() {
  const { workspaceId, role } = await requireActiveWorkspace();

  // Default range on first load — week containing today (CalendarShell
  // refetches client-side whenever the view/date changes after that).
  const weekStart = getMonday(new Date());
  const weekEnd = addDays(weekStart, 7);

  const [events, members, conversationOptions, opportunityOptions, ownMemberId] = await Promise.all([
    getCalendarEvents(workspaceId, weekStart.toISOString(), weekEnd.toISOString()),
    getWorkspaceMembers(workspaceId),
    getConversationOptions(workspaceId),
    getOpportunityOptions(workspaceId),
    getCurrentMemberId(workspaceId),
  ]);

  return (
    <CalendarShell
      initialDateISO={new Date().toISOString()}
      initialEvents={events}
      members={members}
      conversationOptions={conversationOptions}
      opportunityOptions={opportunityOptions}
      canAssignOthers={role === "owner" || role === "admin"}
      ownMemberId={ownMemberId}
    />
  );
}
