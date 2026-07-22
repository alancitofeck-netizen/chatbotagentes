import type { EventType } from "@/lib/calendar/queries";

/** Visual identity per event type — reunión/seguimiento/llamada/tarea map to
 * the colors requested (azul/verde/naranja/gris); "demo" isn't one of those
 * named categories so it gets its own accent (violet) rather than collapsing
 * into "reunión"; "otro" reads as the catch-all/urgent red. `bar` is the
 * solid color used for the card's left accent stripe; `bg`/`text`/`dot` are
 * for softer chips (Month view, Agenda, badges); `solid` is the flat swatch
 * color used in the sidebar's category legend. */
export const EVENT_TYPE_META: Record<
  EventType,
  { label: string; bar: string; border: string; bg: string; text: string; dot: string; solid: string }
> = {
  meeting: {
    label: "Reunión",
    bar: "bg-primary-500",
    border: "border-l-primary-500",
    bg: "bg-primary-50",
    text: "text-primary-700",
    dot: "bg-primary-500",
    solid: "bg-primary-500",
  },
  follow_up: {
    label: "Seguimiento",
    bar: "bg-success",
    border: "border-l-success",
    bg: "bg-success-bg",
    text: "text-success-strong",
    dot: "bg-success",
    solid: "bg-success",
  },
  call: {
    label: "Llamada",
    bar: "bg-warning",
    border: "border-l-warning",
    bg: "bg-warning-bg",
    text: "text-warning-strong",
    dot: "bg-warning",
    solid: "bg-warning",
  },
  demo: {
    label: "Demo",
    bar: "bg-accent-500",
    border: "border-l-accent-500",
    bg: "bg-accent-50",
    text: "text-accent-700",
    dot: "bg-accent-500",
    solid: "bg-accent-500",
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
    bar: "bg-error",
    border: "border-l-error",
    bg: "bg-error-bg",
    text: "text-error-strong",
    dot: "bg-error",
    solid: "bg-error",
  },
  // System-generated placeholder for an opportunity's "fecha de cierre
  // estimada" (src/lib/crm/calendarSync.ts) — its own color (amber, not one
  // of the 6 design-system semantic families already claimed by the other
  // types above) so it reads as distinct from a real scheduled meeting.
  estimated_close: {
    label: "Cierre estimado",
    bar: "bg-amber-500",
    border: "border-l-amber-500",
    bg: "bg-amber-50",
    text: "text-amber-700",
    dot: "bg-amber-500",
    solid: "bg-amber-500",
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
