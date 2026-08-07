"use client";

import { motion } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { Button } from "@/components/ui/Button";
import { Settings2 } from "lucide-react";
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
      className="group flex flex-col gap-4 rounded-lg border border-border-default bg-surface-1 p-5 shadow-[var(--elevation-sm)] transition-shadow duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:border-accent-500 hover:shadow-[var(--elevation-md)]"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <Icon className="size-6" aria-hidden="true" />
        </span>
        <Switch checked={automation.enabled} onChange={onToggle} label={`Activar ${automation.name}`} />
      </div>

      <div className="flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="text-sm font-semibold text-foreground">{automation.name}</p>
          <Badge variant={automation.enabled ? "success" : "neutral"} dot>
            {automation.enabled ? "Activa" : "Inactiva"}
          </Badge>
        </div>
        <p className="mt-1 text-[13px] leading-snug text-neutral-500">{automation.description}</p>
        <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-neutral-400">{automation.category}</p>
      </div>

      <Button variant="secondary" size="sm" onClick={onOpen}>
        <Settings2 className="size-3.5" aria-hidden="true" />
        Configurar
      </Button>
    </motion.div>
  );
}
