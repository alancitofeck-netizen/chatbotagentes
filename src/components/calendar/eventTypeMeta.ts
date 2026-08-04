import type { EventType } from "@/lib/calendar/queries";

/** Visual identity per event type — reunión/seguimiento/llamada/tarea map to
 * the colors requested (azul/verde/naranja/gris); "demo" isn't one of those
 * named categories so it gets its own accent (violet) rather than collapsing
 * into "reunión"; "otro" reads as the catch-all/urgent red. `bar` is the
 * solid color used for the card's left accent stripe; `bg`/`text`/`dot` are
 * for softer chips (Month view, Agenda, badges); `solid` is the flat swatch
 * color used in the sidebar's category legend. */
// Paleta propia del Calendario (blue/violet/emerald/amber/red saturados,
// ver calendarColors.ts) — verde reservado para "seguimiento" (lo más
// cercano a un estado positivo entre las categorías reales de bookings),
// nunca como color principal.
export const EVENT_TYPE_META: Record<
  EventType,
  { label: string; bar: string; border: string; bg: string; text: string; dot: string; solid: string }
> = {
  meeting: {
    label: "Reunión",
    bar: "bg-blue-500",
    border: "border-l-blue-500",
    bg: "bg-blue-50",
    text: "text-blue-700",
    dot: "bg-blue-500",
    solid: "bg-blue-500",
  },
  follow_up: {
    label: "Seguimiento",
    bar: "bg-emerald-500",
    border: "border-l-emerald-500",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
    solid: "bg-emerald-500",
  },
  call: {
    label: "Llamada",
    bar: "bg-amber-500",
    border: "border-l-amber-500",
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    solid: "bg-amber-500",
  },
  demo: {
    label: "Demo",
    bar: "bg-violet-500",
    border: "border-l-violet-500",
    bg: "bg-violet-50",
    text: "text-violet-700",
    dot: "bg-violet-500",
    solid: "bg-violet-500",
  },
  task: {
    label: "Tarea",
    bar: "bg-neutral-400",
    border: "border-l-neutral-400",
    bg: "bg-surface-3",
    text: "text-neutral-700",
    dot: "bg-neutral-500",
    solid: "bg-neutral-400",
  },
  other: {
    label: "Otro",
    bar: "bg-red-500",
    border: "border-l-red-500",
    bg: "bg-red-50",
    text: "text-red-700",
    dot: "bg-red-500",
    solid: "bg-red-500",
  },
  // System-generated placeholder for an opportunity's "fecha de cierre
  // estimada" (src/lib/crm/calendarSync.ts) — distinct from "call" now that
  // both would otherwise land on amber; keeps its own cyan-ish accent so it
  // still reads as separate from a real scheduled meeting.
  estimated_close: {
    label: "Cierre estimado",
    bar: "bg-sky-500",
    border: "border-l-sky-500",
    bg: "bg-sky-50",
    text: "text-sky-700",
    dot: "bg-sky-500",
    solid: "bg-sky-500",
  },
};

export const EVENT_TYPE_OPTIONS: { value: EventType; label: string }[] = Object.entries(EVENT_TYPE_META).map(([value, meta]) => ({
  value: value as EventType,
  label: meta.label,
}));

/** Sidebar category filter buckets — collapses the 6 real event types down
 * to the 4-5 named groups from the reference design (meeting absorbs demo,
 * since "demo" isn't a distinct category in the requested filter list). */
export type CategoryKey = "meeting" | "call" | "follow_up" | "task" | "other";
export const CATEGORY_META: Record<CategoryKey, { label: string; solid: string }> = {
  meeting: { label: "Reuniones", solid: EVENT_TYPE_META.meeting.solid },
  call: { label: "Llamadas", solid: EVENT_TYPE_META.call.solid },
  follow_up: { label: "Seguimientos", solid: EVENT_TYPE_META.follow_up.solid },
  task: { label: "Tareas", solid: EVENT_TYPE_META.task.solid },
  other: { label: "Otros", solid: EVENT_TYPE_META.other.solid },
};
export function categoryFor(eventType: EventType): CategoryKey {
  if (eventType === "demo" || eventType === "estimated_close") return "meeting";
  return eventType as CategoryKey;
}

export const REMINDER_OPTIONS = [
  { value: "", label: "Sin recordatorio" },
  { value: "5", label: "5 minutos antes" },
  { value: "15", label: "15 minutos antes" },
  { value: "30", label: "30 minutos antes" },
  { value: "60", label: "1 hora antes" },
  { value: "1440", label: "1 día antes" },
];
