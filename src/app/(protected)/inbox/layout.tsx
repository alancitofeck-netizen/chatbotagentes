import type { ReactNode } from "react";
import { InboxSecondaryNav } from "./InboxSecondaryNav";

/** First nested layout in the app (only src/app/(protected)/layout.tsx
 * existed before this) — hosts Inbox's secondary nav (Conversaciones /
 * Contactos / Etiquetas / Plantillas) so the whole area reads as one unified
 * communication space instead of separate top-level sidebar items.
 *
 * `min-h-0` on the children wrapper matters: it's a flex child of a column
 * flex container, and without it a tall child (InboxShell/ContactsShell,
 * both `h-full`) would refuse to shrink below its content size and break the
 * "fill remaining height, scroll internally" behavior those shells rely on. */
export default function InboxLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <InboxSecondaryNav />
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
