"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { AUTOMATION_ICON_MAP } from "./icons";
import type { AutomationTemplate } from "@/lib/automationTemplates/queries";

export function AutomationCard({
  automation,
  index,
  onToggle,
  onOpen,
}: {
  automation: AutomationTemplate;
  index: number;
  onToggle: (enabled: boolean) => void;
  onOpen: () => void;
}) {
  const Icon = AUTOMATION_ICON_MAP[automation.icon as keyof typeof AUTOMATION_ICON_MAP] ?? AUTOMATION_ICON_MAP.Sparkles;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.3), ease: "easeOut" }}
      whileHover={{ y: -2 }}
      className="group flex items-center gap-4 rounded-lg border border-border-default bg-surface-1 p-4 shadow-[var(--elevation-sm)] transition-shadow duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-accent-500 hover:shadow-[var(--elevation-md)]"
    >
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-4 text-left">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{automation.name}</p>
            <Badge variant={automation.enabled ? "success" : "neutral"} dot>
              {automation.enabled ? "Activa" : "Inactiva"}
            </Badge>
          </div>
          <p className="truncate text-[13px] text-neutral-500">{automation.description}</p>
        </div>
      </button>
      <Switch checked={automation.enabled} onChange={onToggle} label={`Activar ${automation.name}`} />
    </motion.div>
  );
}
