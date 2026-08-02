import { Bell, Search } from "lucide-react";
import { ThemeToggle } from "@/lib/theme/ThemeToggle";
import { MobileNav } from "./MobileNav";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";
import { getNotifications, getUnreadCount, getNotificationPreferences } from "@/lib/notifications/queries";

interface NavbarProps {
  workspaceName: string;
  enabledModules: string[];
  /** Null during "Modo Supervisor" (platform admin viewing a workspace they
   * aren't really a member of — see ProtectedLayout) — there's no real
   * workspace_members row to own a notification feed, so the bell renders
   * as a disabled placeholder in that case instead of a real center. */
  memberId: string | null;
  /** Below `md` the Sidebar (and its own footer UserMenu) is hidden, so the
   * mobile header needs its own profile entry point — see optimización
   * mobile plan §1. Desktop keeps using Sidebar's UserMenu, unchanged. */
  userName: string;
  userEmail: string;
  userAvatarUrl: string | null;
  isPlatformAdmin: boolean;
}

/** Search is still decorative (docs/blueprint/14-design-system.md §10 update,
 * 2026-07-09) — no global search exists yet, hidden below `md` (mobile header
 * is trimmed to hamburguesa/notificaciones/perfil only). Notifications are
 * real as of the notifications module (src/lib/notifications/). `ThemeToggle`
 * moves into MobileNav's drawer below `md` instead of disappearing — same
 * function, different spot, so nothing is actually lost on mobile. */
export async function Navbar({ workspaceName, enabledModules, memberId, userName, userEmail, userAvatarUrl, isPlatformAdmin }: NavbarProps) {
  const [initialNotifications, initialUnreadCount, initialPreferences] = memberId
    ? await Promise.all([getNotifications(), getUnreadCount(), getNotificationPreferences()])
    : [[], 0, null];

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 px-4 sm:px-6 md:h-16">
      <div className="flex items-center gap-3">
        <MobileNav enabledModules={enabledModules} />
        <span className="truncate text-sm font-medium text-neutral-500">{workspaceName}</span>
      </div>
      <div className="flex flex-1 items-center justify-end gap-3">
        <div className="relative hidden w-full max-w-xs md:block" title="Búsqueda global — próximamente">
          <Search
            size={15}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400"
          />
          <input
            type="search"
            placeholder="Buscar…"
            className="w-full rounded-full border border-border-default bg-surface-2 py-2 pl-9 pr-4 text-sm outline-none transition-colors duration-[var(--duration-fast)] focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        </div>
        {memberId ? (
          <NotificationBell
            memberId={memberId}
            initialNotifications={initialNotifications}
            initialUnreadCount={initialUnreadCount}
            initialPreferences={initialPreferences}
          />
        ) : (
          <button
            type="button"
            title="Notificaciones no disponibles en Modo Supervisor"
            aria-label="Notificaciones"
            disabled
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-300 dark:text-neutral-600"
          >
            <Bell size={17} aria-hidden="true" />
          </button>
        )}
        <div className="md:hidden">
          <UserMenu name={userName} email={userEmail} avatarUrl={userAvatarUrl} isPlatformAdmin={isPlatformAdmin} />
        </div>
        <ThemeToggle className="hidden md:flex" />
      </div>
    </header>
  );
}
