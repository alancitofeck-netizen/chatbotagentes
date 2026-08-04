/**
 * Identidad visual propia del Inbox — deliberadamente separada de los tokens
 * compartidos (`accent-*`/`primary-*` en globals.css, docs/blueprint/14-design-system.md),
 * a pedido explícito del usuario: el resto de la app (CRM, Dashboard,
 * Calendario, etc.) sigue con su paleta azul profundo/violeta apagado
 * actual, sin tocar. Estos son colores "de fábrica" de Tailwind (no tokens
 * custom) usados únicamente dentro de src/app/(protected)/inbox/ — nunca
 * importar esto fuera de esa carpeta.
 */

/** Azul — acción primaria (botón de enviar, link activo, foco). */
export const INBOX_PRIMARY = {
  bg: "bg-blue-600",
  bgHover: "hover:bg-blue-700",
  text: "text-blue-600",
  textStrong: "text-blue-700",
  border: "border-blue-600",
  ring: "focus:ring-blue-200",
  tint: "bg-blue-50",
  tintText: "text-blue-700",
  dot: "bg-blue-500",
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
  "inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3.5 py-2 text-[13px] font-medium text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40";

/** Botón secundario — borde, fondo transparente */
export const inboxSecondaryButton =
  "inline-flex items-center gap-1.5 rounded-full border border-neutral-300 px-3.5 py-2 text-[13px] font-medium text-foreground transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700";
