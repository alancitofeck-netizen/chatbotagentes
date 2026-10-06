/**
 * Colores del Inbox. La acción primaria usa los tokens `accent-*` de la marca
 * (teal, docs/blueprint/14-design-system.md §2 y la nota de rediseño). El
 * violeta queda sólo para lo relacionado a IA. Estos colores son de Tailwind
 * a propósito: el Inbox los consume por clase y no hay token semántico extra.
 */

/** Teal de marca — acción primaria (botón de enviar, link activo, foco). */
export const INBOX_PRIMARY = {
  bg: "bg-accent-600",
  bgHover: "hover:bg-accent-700",
  text: "text-accent-600",
  textStrong: "text-accent-700",
  border: "border-accent-600",
  ring: "focus:ring-accent-200",
  tint: "bg-accent-50",
  tintText: "text-accent-700",
  dot: "bg-accent-500",
} as const;

/** Violeta — secundario, reservado para todo lo relacionado a IA (mismo
 * significado que ya tenía el violeta accent en el resto de la app). */
export const INBOX_SECONDARY = {
  bg: "bg-violet-600",
  bgHover: "hover:bg-violet-700",
  text: "text-violet-600",
  textStrong: "text-violet-700",
  border: "border-violet-300",
  tint: "bg-violet-50",
  tintText: "text-violet-700",
} as const;

export const INBOX_SUCCESS = { tint: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" } as const;
export const INBOX_WARNING = { tint: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" } as const;
export const INBOX_ERROR = { tint: "bg-red-50", text: "text-red-700", dot: "bg-red-500" } as const;

/** Botón de acción primaria — pill, sombra suave, sin depender de <Button> */
export const inboxPrimaryButton =
  "inline-flex items-center gap-1.5 rounded-full bg-accent-600 px-3.5 py-2 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-40";

/** Botón secundario — borde, fondo transparente */
export const inboxSecondaryButton =
  "inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700";
