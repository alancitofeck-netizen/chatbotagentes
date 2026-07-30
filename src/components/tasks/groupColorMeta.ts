import type { GroupColor } from "@/lib/tasks/groups/queries";

/** Same 6 semantic tokens Badge.tsx already defines — group color is
 * restricted to these on purpose, no new hues introduced for this feature. */
export const GROUP_COLOR_META: Record<GroupColor, { label: string; dot: string; bg: string; text: string }> = {
  neutral: { label: "Gris", dot: "bg-neutral-400", bg: "bg-surface-3", text: "text-foreground" },
  accent: { label: "Violeta", dot: "bg-accent-500", bg: "bg-accent-100", text: "text-accent-700" },
  success: { label: "Verde", dot: "bg-success", bg: "bg-success-bg", text: "text-success-strong" },
  warning: { label: "Ámbar", dot: "bg-warning", bg: "bg-warning-bg", text: "text-warning-strong" },
  error: { label: "Rojo", dot: "bg-error", bg: "bg-error-bg", text: "text-error-strong" },
  info: { label: "Azul", dot: "bg-info", bg: "bg-info-bg", text: "text-info-strong" },
};

export const GROUP_COLOR_KEYS = Object.keys(GROUP_COLOR_META) as GroupColor[];

export const GROUP_ICON_PRESETS = [
  "📁", "📘", "📗", "📙", "📕", "📒", "💻", "📣", "📱", "🔧", "🎓", "⭐",
  "🚀", "💬", "📊", "🎯", "🗂️", "🧩", "🛠️", "📞", "🧠", "🗓️", "🧾", "🔗",
];
