"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";
import type { CalendarEvent } from "@/lib/calendar/queries";
import type { TaskOption } from "@/lib/tasks/queries";
import { getCalendarEventsAction, getEventByIdAction } from "@/lib/calendar/actions";
import { addDays, getMonday, parseLocalDate } from "@/lib/calendar/week";
import { TimeGrid } from "./TimeGrid";
import { MonthView } from "./MonthView";
import { AgendaView } from "./AgendaView";
import { EventFormSheet } from "@/components/calendar/EventFormSheet";
import { EventDetailDrawer } from "@/components/calendar/EventDetailDrawer";
import { CalendarSidebar } from "@/components/calendar/CalendarSidebar";
import { categoryFor, type CategoryKey } from "@/components/calendar/eventTypeMeta";

type ViewKey = "day" | "week" | "month" | "agenda";
const VIEWS: { key: ViewKey; label: string }[] = [
  { key: "day", label: "Día" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mes" },
  { key: "agenda", label: "Agenda" },
];
const ALL_CATEGORIES: CategoryKey[] = ["meeting", "call", "follow_up", "task", "other"];

interface MemberOption {
  memberId: string;
  fullName: string;
}

function rangeFor(view: ViewKey, date: Date): { start: Date; end: Date } {
  if (view === "day") return { start: date, end: addDays(date, 1) };
  if (view === "week") {
    const start = getMonday(date);
    return { start, end: addDays(start, 7) };
  }
  if (view === "month") {
    const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    const gridStart = getMonday(firstOfMonth);
    return { start: gridStart, end: addDays(gridStart, 42) };
  }
  // agenda: next 30 days from `date`.
  return { start: date, end: addDays(date, 30) };
}

function formatRangeLabel(view: ViewKey, date: Date): string {
  if (view === "day") return date.toLocaleDateString("es", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
  if (view === "week") {
    const start = getMonday(date);
    const end = addDays(start, 6);
    const sameMonth = start.getMonth() === end.getMonth();
    return `${start.toLocaleDateString("es", { day: "2-digit", month: sameMonth ? undefined : "short" })} – ${end.toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}`;
  }
  if (view === "month") return date.toLocaleDateString("es", { month: "long", year: "numeric" });
  return `Próximos 30 días desde ${date.toLocaleDateString("es", { day: "2-digit", month: "short" })}`;
}

export function CalendarShell({
  initialDateISO,
  initialEvents,
  members,
  conversationOptions,
  opportunityOptions,
  canAssignOthers,
  ownMemberId,
}: {
  initialDateISO: string;
  initialEvents: CalendarEvent[];
  members: MemberOption[];
  conversationOptions: TaskOption[];
  opportunityOptions: TaskOption[];
  canAssignOthers: boolean;
  ownMemberId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Derived directly from the URL on every render (no state/effect) — same
  // fix as ProfileShell/CrmPageShell this session, so links like the
  // Dashboard's "Ver calendario" (or a future deep link) land correctly even
  // when Next.js reuses an already-mounted /calendar instance.
  const requestedView = searchParams.get("view");
  const view: ViewKey = VIEWS.some((v) => v.key === requestedView) ? (requestedView as ViewKey) : "week";
  const dateParam = searchParams.get("date");
  const date = dateParam ? parseLocalDate(dateParam) : new Date(initialDateISO);

  const [events, setEvents] = useState(initialEvents);
  const [sheetState, setSheetState] = useState<
    { mode: "view"; event: CalendarEvent } | { mode: "create"; defaultStart?: Date } | { mode: "edit"; event: CalendarEvent } | null
  >(null);
  const [, startTransition] = useTransition();
  // TimeGrid remounts (via a `key` tied to this + the range) instead of
  // syncing its own local drag/resize state through an effect — that key
  // needs to change on every refetch (a new event created, not just the
  // visible range changing), otherwise TimeGrid's initial-state-from-props
  // would go stale after creating/editing an event within the same range.
  const [refreshTick, setRefreshTick] = useState(0);

  // Sidebar filters — no separate "calendars" entity in the data model, so
  // "Mi calendario"/"Equipo" scope by assignee and the category checkboxes
  // bucket event_type into the reference design's named groups (see
  // eventTypeMeta.ts's categoryFor/CATEGORY_META).
  const [showMine, setShowMine] = useState(true);
  const [showTeam, setShowTeam] = useState(true);
  const [activeCategories, setActiveCategories] = useState<Set<CategoryKey>>(new Set(ALL_CATEGORIES));

  const { start, end } = rangeFor(view, date);

  // Rapid view/date switches (or a switch immediately followed by a create)
  // can have multiple refetches in flight at once; without sequencing, a
  // stale response resolving last would overwrite fresher data. Only the
  // most recently *issued* request is allowed to apply its result.
  const latestRequestId = useRef(0);

  function refetch() {
    const requestId = ++latestRequestId.current;
    const rangeStart = start.toISOString();
    const rangeEnd = end.toISOString();
    startTransition(async () => {
      const fresh = await getCalendarEventsAction(rangeStart, rangeEnd);
      if (requestId !== latestRequestId.current) return;
      setEvents(fresh);
      setRefreshTick((t) => t + 1);
    });
  }

  // Refetch whenever the visible range changes (view or date, via URL).
  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, date.toDateString()]);

  function setUrl(nextView: ViewKey, nextDate: Date) {
    const params = new URLSearchParams();
    params.set("view", nextView);
    params.set("date", nextDate.toISOString().slice(0, 10));
    router.replace(`/calendar?${params.toString()}`, { scroll: false });
  }

  function step(direction: 1 | -1) {
    if (view === "day") setUrl(view, addDays(date, direction));
    else if (view === "week") setUrl(view, addDays(date, direction * 7));
    else if (view === "month") setUrl(view, new Date(date.getFullYear(), date.getMonth() + direction, 1));
    else setUrl(view, addDays(date, direction * 30));
  }

  async function handleSelect(event: CalendarEvent) {
    const fresh = await getEventByIdAction(event.id);
    setSheetState({ mode: "view", event: fresh ?? event });
  }

  // Deep link from outside Calendar — e.g. a CRM card's "Ver en calendario"
  // (src/app/(protected)/crm/OpportunityCardView.tsx) links here with
  // `?event=<bookingId>` alongside `?view=day&date=...`. Runs once on mount,
  // same reasoning as CrmBoardShell's `?opportunity=` reader.
  useEffect(() => {
    const eventId = searchParams.get("event");
    if (!eventId) return;
    getEventByIdAction(eventId).then((event) => {
      if (event) setSheetState({ mode: "view", event });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleCategory(key: CategoryKey) {
    setActiveCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const visibleEvents = events.filter((e) => {
    const isMine = e.assignedTo?.memberId === ownMemberId;
    const scopeOk = (showMine && isMine) || (showTeam && !isMine);
    return scopeOk && activeCategories.has(categoryFor(e.eventType));
  });

  const upcomingEvent =
    visibleEvents
      .filter((e) => e.status !== "cancelled" && new Date(e.endTime) >= new Date())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0] ?? null;

  const days = view === "day" ? [date] : view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(getMonday(date), i)) : [];

  return (
    <div className="flex h-full">
      <CalendarSidebar
        selectedDate={date}
        onSelectDate={(day, targetView) => setUrl(targetView, day)}
        showMine={showMine}
        showTeam={showTeam}
        onToggleMine={() => setShowMine((v) => !v)}
        onToggleTeam={() => setShowTeam((v) => !v)}
        activeCategories={activeCategories}
        onToggleCategory={toggleCategory}
        upcomingEvent={upcomingEvent}
        onOpenUpcoming={handleSelect}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-border-default bg-surface-1">
          <div className="flex items-center justify-between px-6 pt-5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-accent-500/10 text-accent-600">
                <CalendarDays size={18} aria-hidden="true" />
              </span>
              <h1 className="text-[19px] font-semibold text-foreground">Calendario</h1>
            </div>
            <Button size="lg" onClick={() => setSheetState({ mode: "create", defaultStart: date })}>
              <Plus size={17} aria-hidden="true" />
              Nuevo evento
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-6 pb-4 pt-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-0.5 rounded-full border border-border-default bg-surface-1 p-1 shadow-[var(--elevation-xs)]">
                <button
                  type="button"
                  aria-label="Anterior"
                  onClick={() => step(-1)}
                  className="flex size-7 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2 hover:text-foreground"
                >
                  <ChevronLeft size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setUrl(view, new Date())}
                  className="rounded-full px-3 py-1 text-xs font-medium text-neutral-600 hover:bg-surface-2 hover:text-foreground"
                >
                  Hoy
                </button>
                <button
                  type="button"
                  aria-label="Siguiente"
                  onClick={() => step(1)}
                  className="flex size-7 items-center justify-center rounded-full text-neutral-500 hover:bg-surface-2 hover:text-foreground"
                >
                  <ChevronRight size={16} aria-hidden="true" />
                </button>
              </div>
              <span className="text-[15px] font-medium capitalize text-foreground">{formatRangeLabel(view, date)}</span>
            </div>

            <div className="flex gap-1 rounded-full bg-surface-2 p-1">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setUrl(v.key, date)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors",
                    view === v.key ? "bg-surface-1 text-foreground shadow-[var(--elevation-xs)]" : "text-neutral-500 hover:text-foreground",
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {(view === "day" || view === "week") && (
            <TimeGrid key={`${start.toISOString()}-${refreshTick}`} days={days} events={visibleEvents} onSelect={handleSelect} onChanged={refetch} />
          )}
          {view === "month" && (
            <MonthView
              monthDate={date}
              events={visibleEvents}
              onSelect={handleSelect}
              onOpenDay={(day) => setUrl("day", day)}
              onChanged={refetch}
            />
          )}
          {view === "agenda" && <AgendaView events={visibleEvents} onSelect={handleSelect} />}
        </div>
      </div>

      {sheetState?.mode === "view" && (
        <EventDetailDrawer
          event={sheetState.event}
          onClose={() => setSheetState(null)}
          onEdit={() => setSheetState({ mode: "edit", event: sheetState.event })}
          onChanged={refetch}
        />
      )}

      {(sheetState?.mode === "create" || sheetState?.mode === "edit") && (
        <EventFormSheet
          current={sheetState.mode === "edit" ? sheetState.event : null}
          defaultStart={sheetState.mode === "create" ? sheetState.defaultStart : undefined}
          members={members}
          conversationOptions={conversationOptions}
          opportunityOptions={opportunityOptions}
          canAssignOthers={canAssignOthers}
          ownMemberId={ownMemberId}
          onClose={() => setSheetState(null)}
          onSaved={() => {
            setSheetState(null);
            refetch();
          }}
          onDeleted={() => {
            setSheetState(null);
            refetch();
          }}
        />
      )}
    </div>
  );
}
