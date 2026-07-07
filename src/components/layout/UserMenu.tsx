"use client";

import { useRef } from "react";
import { LogOut, User } from "lucide-react";
import { signOut } from "@/app/(protected)/actions";

interface UserMenuProps {
  name: string;
  email: string;
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

export function UserMenu({ name, email }: UserMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  return (
    <details ref={detailsRef} className="group relative">
      <summary
        className="flex cursor-pointer list-none items-center gap-2 rounded-full outline-none focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
        aria-label="Menú de perfil"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-primary-600 text-xs font-semibold text-white">
          {initialsFrom(name, email) || <User className="size-4" aria-hidden="true" />}
        </span>
      </summary>

      <div className="absolute right-0 z-20 mt-2 w-56 rounded-md border border-border-default bg-surface-1 p-1.5 shadow-[var(--elevation-md)]">
        <div className="flex flex-col px-2.5 py-2">
          <span className="truncate text-sm font-medium text-foreground">{name || "Tu cuenta"}</span>
          <span className="truncate text-xs text-neutral-500">{email}</span>
        </div>
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
