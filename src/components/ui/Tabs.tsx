"use client";

import { createContext, useContext, useId } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

interface TabsContextValue {
  value: string;
  setValue: (value: string) => void;
  name: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const ctx = useContext(TabsContext);
  if (!ctx) throw new Error("Tabs.* debe usarse dentro de <Tabs>");
  return ctx;
}

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
}

/** Controlled tabs — subrayado accent-500, sin fondo tipo pill (14-design-system.md §10). */
export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  const name = useId();
  return (
    <TabsContext.Provider value={{ value, setValue: onValueChange, name }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div role="tablist" className={cn("flex gap-5 border-b border-border-default", className)}>
      {children}
    </div>
  );
}

/** Shared visual language for both the controlled (`TabsTrigger`) and
 * route-driven (`TabLink`) variants — one string, so the two never drift.
 * Exported for bespoke tab strips that mix query-param state with real
 * routes in one row (e.g. CRM's tab strip, whose "ATS" entry links out to
 * /ats while the rest stay ?tab= driven) and can't reuse TabLink as-is. */
export function tabItemClassName(active: boolean, disabled: boolean) {
  return cn(
    "flex items-center gap-1.5 border-b-2 px-0.5 py-2.5 text-sm font-medium transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
    "focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2",
    disabled && "cursor-default text-neutral-400",
    !disabled && active && "border-accent-500 text-foreground",
    !disabled && !active && "border-transparent text-neutral-500 hover:text-foreground",
  );
}

export function TabsTrigger({
  value,
  children,
  disabled = false,
}: {
  value: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  const ctx = useTabsContext();
  const active = ctx.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      disabled={disabled}
      onClick={() => !disabled && ctx.setValue(value)}
      className={tabItemClassName(active, disabled)}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }: { value: string; children: ReactNode }) {
  const ctx = useTabsContext();
  if (ctx.value !== value) return null;
  return <div role="tabpanel">{children}</div>;
}

/** Link-based sibling to TabsTrigger for real nested routes (e.g. Inbox's
 * secondary nav: /inbox, /inbox/contactos, ...) instead of in-page state —
 * same visual language, active state comes from the URL via usePathname()
 * instead of a controlled value. `exact` forces exact-match instead of
 * prefix-match (needed for a parent route like /inbox that would otherwise
 * always read as active on every child route too). */
export function TabLink({
  href,
  exact = false,
  children,
}: {
  href: string;
  exact?: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link href={href} role="tab" aria-selected={active} className={tabItemClassName(active, false)}>
      {children}
    </Link>
  );
}
