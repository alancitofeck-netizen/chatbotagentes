import { Badge } from "@/components/ui/Badge";

/** The "identificación visual" the user asked for — one place so the
 * emoji/copy/variant stay in sync everywhere a mini-app-sourced contact
 * renders: ContactList.tsx (conditionally), AppContactList.tsx (always),
 * ContactDetailPanel.tsx's header. */
export function MiniAppContactBadge() {
  return <Badge variant="accent">📱 Mini App</Badge>;
}
