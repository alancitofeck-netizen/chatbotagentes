"use client";

import { createContext, useContext, useId } from "react";
import type { ReactNode } from "react";
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
      className={cn(
        "flex items-center gap-1.5 border-b-2 px-0.5 py-2.5 text-sm font-medium transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
        "focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2",
        disabled && "cursor-default text-neutral-400",
        !disabled && active && "border-accent-500 text-foreground",
        !disabled && !active && "border-transparent text-neutral-500 hover:text-foreground",
      )}
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
