import { Bell } from "lucide-react";
import { ThemeToggle } from "@/lib/theme/ThemeToggle";
import { MobileNav } from "./MobileNav";
import { NotificationBell } from "./NotificationBell";
import { UserMenu } from "./UserMenu";
import { GlobalSearch } from "./GlobalSearch";
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

/** Global search (GlobalSearch.tsx, backed by src/lib/search/) is real as of
 * the Buscador Global Inteligente work — still hidden below `md` (mobile
 * header is trimmed to hamburguesa/notificaciones/perfil only, same as
 * before). Notifications are real as of the notifications module
 * (src/lib/notifications/). `ThemeToggle` moves into MobileNav's drawer
 * below `md` instead of disappearing — same function, different spot, so
 * nothing is actually lost on mobile. */
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
        <GlobalSearch />
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
