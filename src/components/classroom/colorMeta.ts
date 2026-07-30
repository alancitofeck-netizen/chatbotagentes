import type { ClassroomColor } from "@/lib/classroom/categories/queries";
import type { CourseLevel } from "@/lib/classroom/courses/queries";
import type { BadgeVariant } from "@/components/ui/Badge";

/** Same 6 semantic tokens Badge.tsx/GROUP_COLOR_META already define — no new
 * hues introduced for Classroom either. */
export const CLASSROOM_COLOR_META: Record<ClassroomColor, { label: string; dot: string; bg: string; text: string }> = {
  neutral: { label: "Gris", dot: "bg-neutral-400", bg: "bg-surface-3", text: "text-foreground" },
  accent: { label: "Violeta", dot: "bg-accent-500", bg: "bg-accent-100", text: "text-accent-700" },
  success: { label: "Verde", dot: "bg-success", bg: "bg-success-bg", text: "text-success-strong" },
  warning: { label: "Ámbar", dot: "bg-warning", bg: "bg-warning-bg", text: "text-warning-strong" },
  error: { label: "Rojo", dot: "bg-error", bg: "bg-error-bg", text: "text-error-strong" },
  info: { label: "Azul", dot: "bg-info", bg: "bg-info-bg", text: "text-info-strong" },
};

export const CLASSROOM_COLOR_KEYS = Object.keys(CLASSROOM_COLOR_META) as ClassroomColor[];

export const CLASSROOM_ICON_PRESETS = [
  "📚", "💻", "🤖", "💬", "⚡", "📈", "🚀", "🎯", "🧩", "🔗", "🛠️", "🎓",
  "📊", "📣", "🧠", "🗂️", "📞", "🧾", "⭐", "🔥",
];

export const COURSE_LEVEL_META: Record<CourseLevel, { label: string; badge: BadgeVariant }> = {
  beginner: { label: "Principiante", badge: "success" },
  intermediate: { label: "Intermedio", badge: "warning" },
  advanced: { label: "Avanzado", badge: "error" },
};
