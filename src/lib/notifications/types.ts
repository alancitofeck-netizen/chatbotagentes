import type { NotificationCategory } from "@/lib/notifications/catalog";

/** Plain shared types, deliberately not declared in queries.ts (server-only)
 * or actions.ts ("use server") — re-exporting a type through either of those
 * boundaries into a client component (NotificationBell.tsx, NotificationPanel.tsx)
 * produced `ReferenceError: NotificationRow is not defined` in production:
 * Next's "use server" reference-manifest transform doesn't reliably elide a
 * combined `export type { X, Y };` re-export, so the client bundle ends up
 * with a dangling reference to a binding that was erased at compile time. */
export interface NotificationRow {
  id: string;
  category: NotificationCategory;
  eventType: string;
  priority: "info" | "success" | "warning" | "error";
  title: string;
  message: string;
  actionUrl: string | null;
  metadata: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface NotificationPreference {
  enabled: boolean;
  email: boolean;
  push: boolean;
}
