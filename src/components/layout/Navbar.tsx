import Image from "next/image";
import Link from "next/link";
import { Bell } from "lucide-react";
import { ThemeToggle } from "@/lib/theme/ThemeToggle";
import { MobileNav } from "./MobileNav";
import { NotificationBell } from "./NotificationBell";
import { GlobalSearch } from "./GlobalSearch";
import { HelpCenterButton } from "@/components/onboarding/HelpCenterButton";
import { getNotifications, getUnreadCount, getNotificationPreferences } from "@/lib/notifications/queries";

interface NavbarProps {
  workspaceName: string;
  role: string;
  enabledModules: string[];
  /** Null during "Modo Supervisor" (platform admin viewing a workspace they
   * aren't really a member of — see ProtectedLayout) — there's no real
   * workspace_members row to own a notification feed, so the bell renders
   * as a disabled placeholder in that case instead of a real center. */
  memberId: string | null;
  /** Para el perfil del menú "Más" (mobile). Desktop usa el UserMenu del Sidebar. */
  userName: string;
  isPlatformAdmin: boolean;
}

/** Mobile (como la referencia): logo GL + "Growth Link" + nombre del workspace a
 * la izquierda; ayuda, notificaciones y modo oscuro a la derecha. Sin
 * hamburguesa (el menú se abre desde "Más" de la barra inferior), sin búsqueda
 * global y sin avatar (Perfil, Configuración, cambiar de workspace y cerrar
 * sesión están en "Más").
 *
 * Global search (GlobalSearch.tsx, backed by src/lib/search/) is real as of
 * the Buscador Global Inteligente work — still hidden below `md` (mobile
 * header is trimmed to hamburguesa/notificaciones/perfil only, same as
 * before). Notifications are real as of the notifications module
 * (src/lib/notifications/). `ThemeToggle` moves into MobileNav's drawer
 * below `md` instead of disappearing — same function, different spot, so
 * nothing is actually lost on mobile. */
export async function Navbar({ workspaceName, role, enabledModules, memberId, userName, isPlatformAdmin }: NavbarProps) {
  const [initialNotifications, initialUnreadCount, initialPreferences] = memberId
    ? await Promise.all([getNotifications(), getUnreadCount(), getNotificationPreferences()])
    : [[], 0, null];

  return (
    <header className="flex h-[calc(3.5rem+env(safe-area-inset-top))] shrink-0 items-center justify-between gap-4 px-4 pt-[env(safe-area-inset-top)] sm:px-6 md:h-16 md:pt-0">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNav enabledModules={enabledModules} userName={userName} workspaceName={workspaceName} role={role} isPlatformAdmin={isPlatformAdmin} />
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2.5 md:hidden">
          <Image src="/icon-192.png" alt="" width={36} height={36} className="size-9 shrink-0 rounded-xl" priority />
          <span className="flex min-w-0 flex-col">
            <span className="font-display text-[16px] leading-tight font-semibold tracking-[-0.01em] text-foreground">Growth Link</span>
            <span className="truncate text-xs text-neutral-500">{workspaceName}</span>
          </span>
        </Link>
        <span className="truncate text-sm font-medium text-neutral-500 max-md:hidden">{workspaceName}</span>
      </div>
      <div className="flex flex-1 items-center justify-end gap-3 max-md:gap-1">
        <div className="max-md:hidden">
          <GlobalSearch />
        </div>
        {memberId && <HelpCenterButton />}
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
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-neutral-300 dark:text-neutral-600 max-md:size-11"
          >
            <Bell size={17} aria-hidden="true" />
          </button>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
