"use client";

import { useRef } from "react";
import Link from "next/link";
import { HelpCircle, LogOut, Settings, ShieldCheck, User, UserCircle } from "lucide-react";
import { signOut } from "@/app/(protected)/actions";
import { cn } from "@/lib/utils/cn";

interface UserMenuProps {
  name: string;
  email: string;
  /** "navbar" (default): dropdown opens below, anchored right — original
   * placement. "sidebar": trigger sits at the foot of the icon dock
   * (Sidebar.tsx), dropdown opens upward and to the right instead, since
   * there's no room below/to the left inside the dock. */
  variant?: "navbar" | "sidebar";
  /** Owner global only (public.platform_admins) — shows a shortcut into the
   * CRM "Agentes" tab, which doubles as the cross-workspace client list for
   * this account (src/app/(protected)/crm/PlatformWorkspacesTable.tsx) —
   * not a separate admin module. Resolved server-side in
   * (protected)/layout.tsx via isPlatformAdmin(), not derivable from role
   * (that's per-workspace; this is a separate, orthogonal flag). */
  isPlatformAdmin?: boolean;
}

function initialsFrom(name: string, email: string) {
  const source = name || email;
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function UserMenu({ name, email, variant = "navbar", isPlatformAdmin = false }: UserMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const isSidebar = variant === "sidebar";

  function closeMenu() {
    if (detailsRef.current) detailsRef.current.open = false;
  }

  return (
    <details ref={detailsRef} className="group relative">
      <summary
        className="flex cursor-pointer list-none items-center gap-2 rounded-full outline-none focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
        aria-label="Menú de perfil"
      >
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-full text-xs font-semibold text-white",
            isSidebar ? "bg-accent-500" : "bg-primary-600",
          )}
        >
          {initialsFrom(name, email) || <User className="size-4" aria-hidden="true" />}
        </span>
      </summary>

      <div
        className={cn(
          "absolute z-20 w-56 rounded-md border border-border-default bg-surface-1 p-1.5 shadow-[var(--elevation-md)]",
          isSidebar ? "bottom-0 left-full ml-2" : "right-0 mt-2",
        )}
      >
        <div className="flex flex-col px-2.5 py-2">
          <span className="truncate text-sm font-medium text-foreground">{name || "Tu cuenta"}</span>
          <span className="truncate text-xs text-neutral-500">{email}</span>
        </div>
        <div className="my-1 h-px bg-border-default" />

        <Link
          href="/profile"
          onClick={closeMenu}
          className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-foreground hover:bg-surface-2"
        >
          <UserCircle className="size-4" aria-hidden="true" />
          Mi perfil
        </Link>
        <Link
          href="/profile?tab=account"
          onClick={closeMenu}
          className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-foreground hover:bg-surface-2"
        >
          <Settings className="size-4" aria-hidden="true" />
          Configuración de cuenta
        </Link>
        <button
          type="button"
          disabled
          title="Próximamente"
          className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-neutral-400 disabled:cursor-not-allowed"
        >
          <HelpCircle className="size-4" aria-hidden="true" />
          Ayuda
        </button>

        {isPlatformAdmin && (
          <>
            <div className="my-1 h-px bg-border-default" />
            <Link
              href="/crm?tab=agents"
              onClick={closeMenu}
              className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-foreground hover:bg-surface-2"
            >
              <ShieldCheck className="size-4" aria-hidden="true" />
              Workspaces de clientes
            </Link>
          </>
        )}

        <div className="my-1 h-px bg-border-default" />
        <form action={signOut}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-sm px-2.5 py-2 text-left text-sm text-foreground hover:bg-surface-2"
          >
            <LogOut className="size-4" aria-hidden="true" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </details>
  );
}
