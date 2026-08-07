"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils/cn";

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

/** Track verde/gris + thumb animado — usado hoy solo por Automatizaciones,
 * pero es un primitivo genérico (no acoplado a ese módulo) para que
 * cualquier pantalla futura con un ON/OFF real lo reuse en vez de duplicar
 * el patrón "pill" ya usado en NotificationPreferencesCard. */
export function Switch({ checked, onChange, disabled = false, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
        "focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2",
        checked ? "bg-success-strong" : "bg-neutral-300 dark:bg-neutral-600",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 32 }}
        className="size-[18px] rounded-full bg-white shadow-[var(--elevation-xs)]"
        style={{ marginLeft: checked ? "calc(100% - 18px - 3px)" : 3 }}
      />
    </button>
  );
}
