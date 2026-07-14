import type { ToolContext } from "@/lib/ai/tools/shared";
import {
  BUSINESS_UTC_OFFSET_HOURS,
  BUSINESS_HOURS_START,
  BUSINESS_HOURS_END,
  BUSINESS_DAYS,
  SLOT_STEP_MINUTES,
  DEFAULT_DURATION_MINUTES,
} from "@/lib/ai/tools/agendaConfig";

/** `check_agenda_availability` — read-only. Workspace-wide availability
 * (no per-agent calendars distinguished here), hardcoded business hours
 * (see agendaConfig.ts — scope cut, no `business_hours` table this round). */
export async function checkAgendaAvailability(args: Record<string, unknown>, ctx: ToolContext): Promise<unknown> {
  const date = String(args.date ?? "");
  const durationMinutes = typeof args.duration_minutes === "number" ? args.duration_minutes : DEFAULT_DURATION_MINUTES;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("date must be YYYY-MM-DD");

  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  if (!BUSINESS_DAYS.includes(weekday)) {
    return { slots: [] };
  }

  const { data: existing } = await ctx.supabase
    .from("bookings")
    .select("start_time, end_time")
    .eq("workspace_id", ctx.workspaceId)
    .neq("status", "cancelled")
    .gte("start_time", `${date}T00:00:00Z`)
    .lt("start_time", `${date}T23:59:59Z`);

  const busy = (existing ?? []).map((b) => ({
    start: new Date(b.start_time as string).getTime(),
    end: new Date(b.end_time as string).getTime(),
  }));

  const slots: string[] = [];
  const dayStartMinutes = BUSINESS_HOURS_START * 60;
  const dayEndMinutes = BUSINESS_HOURS_END * 60;

  for (let localMinutes = dayStartMinutes; localMinutes + durationMinutes <= dayEndMinutes; localMinutes += SLOT_STEP_MINUTES) {
    const utcMinutes = localMinutes + BUSINESS_UTC_OFFSET_HOURS * 60;
    const slotStart = new Date(`${date}T00:00:00Z`);
    slotStart.setUTCMinutes(utcMinutes);
    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);

    const overlaps = busy.some((b) => slotStart.getTime() < b.end && slotEnd.getTime() > b.start);
    if (!overlaps) slots.push(slotStart.toISOString());
  }

  return { slots, durationMinutes };
}
