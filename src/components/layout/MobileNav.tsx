"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils/cn";
import { getNavItems, isNavItemActive } from "./Sidebar";

export function MobileNav({ enabledModules }: { enabledModules: string[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const navItems = getNavItems(new Set(enabledModules));

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Abrir menú"
        className="flex size-9 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2 hover:text-foreground"
      >
        <Menu className="size-5" aria-hidden="true" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <button
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-neutral-950/40"
          />
          <div className="relative flex w-[260px] flex-col gap-1 bg-surface-1 p-4 shadow-[var(--elevation-lg)]">
            <div className="mb-4 flex items-center justify-between">
              <Logo />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar menú"
                className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const isActive = isNavItemActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.comingSoon ? "#" : item.href}
                    onClick={(e) => {
                      if (item.comingSoon) e.preventDefault();
                      else setOpen(false);
                    }}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                      item.comingSoon
                        ? "cursor-default text-neutral-400"
                        : isActive
                          ? "bg-surface-2 text-foreground"
                          : "text-neutral-500 hover:bg-surface-2 hover:text-foreground",
                    )}
                  >
                    <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                    {item.comingSoon && (
                      <Badge variant="neutral" className="ml-auto">
                        Pronto
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
