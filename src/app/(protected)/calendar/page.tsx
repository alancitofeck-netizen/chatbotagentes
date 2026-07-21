import type { Metadata } from "next";
import { getCurrentMemberId, requireActiveWorkspace } from "@/lib/auth/session";
import { getCalendarEvents } from "@/lib/calendar/queries";
import { getWorkspaceMembers } from "@/lib/inbox/queries";
import { getConversationOptions } from "@/lib/tasks/queries";
import { getOpportunityOptions } from "@/lib/crm/queries";
import { addDays, getMonday } from "@/lib/calendar/week";
import { importGoogleEvents } from "@/lib/integrations/googleCalendar";
import { CalendarShell } from "./CalendarShell";

export const metadata: Metadata = {
  title: "Calendario — Growth Link",
};

export default async function CalendarPage() {
  const { workspaceId, role } = await requireActiveWorkspace();

  // Best-effort Google→CRM refresh on every page load, in addition to the
  // pg_cron tick every 3 minutes (0036_pgcron_calendar_sync.sql) — opening
  // the page shouldn't have to wait for the next cron cycle to show an
  // event just created in Google Calendar. importGoogleEvents no-ops
  // (returns {imported: 0}) if this workspace never connected Calendar, so
  // this is safe to call unconditionally; never let it block the page if
  // Google is slow/down.
  await importGoogleEvents(workspaceId).catch((err) => {
    console.error(`[calendar] Google import on page load failed for workspace ${workspaceId}:`, err);
  });

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
