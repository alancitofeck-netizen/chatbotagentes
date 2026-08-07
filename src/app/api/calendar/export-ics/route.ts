import { NextResponse } from "next/server";
import { getUser, getActiveWorkspaceForUser, getCurrentMemberId } from "@/lib/auth/session";
import { getCalendarEvents } from "@/lib/calendar/queries";
import { buildIcsCalendar } from "@/lib/dataTransfer/ics";
import { logExportJob } from "@/lib/dataTransfer/queries";

/** Mismo patrón redirect-free que /api/documents/export y /api/policies/export. */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const active = await getActiveWorkspaceForUser(user.id);
  if (!active) return NextResponse.json({ error: "no_active_workspace" }, { status: 403 });

  const now = new Date();
  const rangeStart = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString();
  const rangeEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()).toISOString();
  const events = await getCalendarEvents(active.workspaceId, rangeStart, rangeEnd);

  const filenameBase = `agenda-${new Date().toISOString().slice(0, 10)}`;
  const memberId = await getCurrentMemberId(active.workspaceId);
  void logExportJob(active.workspaceId, memberId, "calendar", "ics", `${filenameBase}.ics`, events.length);

  return new NextResponse(buildIcsCalendar(events), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filenameBase}.ics"`,
    },
  });
}
