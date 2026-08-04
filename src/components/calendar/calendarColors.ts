/**
 * Identidad visual propia del Calendario — mismo criterio que
 * src/app/(protected)/inbox/inboxColors.ts: colores "de fábrica" de Tailwind,
 * deliberadamente separados de los tokens compartidos (accent-* / primary-*
 * en globals.css), usados únicamente dentro de src/app/(protected)/calendar/ y
 * src/components/calendar/. El resto de la app sigue con su paleta actual.
 */
export const CAL_PRIMARY = {
  bg: "bg-blue-600",
  bgHover: "hover:bg-blue-700",
  text: "text-blue-600",
  textStrong: "text-blue-700",
  tint: "bg-blue-50",
  tintText: "text-blue-700",
  ring: "focus:ring-blue-200",
  border: "focus:border-blue-500",
} as const;

export const CAL_SECONDARY = {
  bg: "bg-violet-600",
  text: "text-violet-600",
  tint: "bg-violet-50",
  tintText: "text-violet-700",
} as const;

export const CAL_SUCCESS = { tint: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", solid: "bg-emerald-500" } as const;
export const CAL_WARNING = { tint: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", solid: "bg-amber-500" } as const;
export const CAL_ERROR = { tint: "bg-red-50", text: "text-red-700", dot: "bg-red-500", solid: "bg-red-500" } as const;

export const calSecondaryButton =
  "inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3 py-1.5 text-[13px] font-medium text-foreground transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700";
export const calPrimaryButton =
  "inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1.5 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40";

/** Detecta el proveedor de videollamada por el dominio de la URL — no hace
 * falta un campo nuevo, meetingUrl ya alcanza. */
export function meetingChannel(url: string | null): { label: string; tint: string; text: string } | null {
  if (!url) return null;
  if (url.includes("meet.google.com")) return { label: "Google Meet", tint: "bg-emerald-50", text: "text-emerald-700" };
  if (url.includes("zoom.us")) return { label: "Zoom", tint: "bg-blue-50", text: "text-blue-700" };
  if (url.includes("teams.microsoft.com")) return { label: "Teams", tint: "bg-violet-50", text: "text-violet-700" };
  return { label: "Videollamada", tint: "bg-surface-3", text: "text-neutral-600" };
}
