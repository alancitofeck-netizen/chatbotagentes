"use client";

import { useEffect, useRef } from "react";
import { toast } from "@/components/toast/toast";
import { getUpcomingEventsAction } from "@/lib/calendar/actions";

const POLL_MS = 60_000;

/** In-app reminders — explicitly scoped down (per the user's own choice):
 * no email/WhatsApp sending, no backend job. This polls upcoming events on
 * an interval while the CRM is open in the browser and fires the existing
 * toast system once an event enters its reminder window — honestly labeled
 * as "only while the CRM tab is open" rather than a real push notification
 * system, since none exists in this project. Mounted once in the protected
 * layout (src/app/(protected)/layout.tsx) so it works from any page, not
 * just /calendar. */
export function ReminderWatcher() {
  const notifiedIds = useRef(new Set<string>());

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const events = await getUpcomingEventsAction();
        if (cancelled) return;
        const now = Date.now();
        for (const event of events) {
          if (!event.reminderMinutes || notifiedIds.current.has(event.id)) continue;
          const remindAt = new Date(event.startTime).getTime() - event.reminderMinutes * 60_000;
          if (now >= remindAt && now < new Date(event.startTime).getTime()) {
            notifiedIds.current.add(event.id);
            const minutesLeft = Math.round((new Date(event.startTime).getTime() - now) / 60_000);
            toast.info(`Recordatorio: ${event.title}`, `Empieza en ${minutesLeft} min`);
          }
        }
      } catch {
        // Silent — a missed reminder tick isn't worth surfacing an error toast for.
      }
    }

    check();
    const interval = setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return null;
}
