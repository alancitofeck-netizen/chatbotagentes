"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "@/components/toast/toast";
import { cn } from "@/lib/utils/cn";
import { getAutomationsBoardAction, updateAutomationAction } from "@/lib/automationTemplates/actions";
import type { AutomationTemplate } from "@/lib/automationTemplates/queries";
import { AutomationCard } from "./AutomationCard";
import { AutomationDrawer } from "./AutomationDrawer";

type Filter = "all" | "active" | "inactive";

const FILTER_LABEL: Record<Filter, string> = { all: "Todas", active: "Activas", inactive: "Inactivas" };

export function AutomationsShell({ initialAutomations }: { initialAutomations: AutomationTemplate[] }) {
  const [automations, setAutomations] = useState(initialAutomations);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const activeCount = automations.filter((a) => a.enabled).length;
  const inactiveCount = automations.length - activeCount;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return automations.filter((a) => {
      if (filter === "active" && !a.enabled) return false;
      if (filter === "inactive" && a.enabled) return false;
      if (query && !a.name.toLowerCase().includes(query) && !a.description.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [automations, search, filter]);

  function patchLocal(id: string, patch: Partial<AutomationTemplate>) {
    setAutomations((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  async function handleToggle(automation: AutomationTemplate, enabled: boolean) {
    patchLocal(automation.id, { enabled });
    try {
      await updateAutomationAction(automation.id, { enabled });
    } catch (err) {
      patchLocal(automation.id, { enabled: automation.enabled });
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar.");
    }
  }

  async function refresh() {
    const board = await getAutomationsBoardAction();
    setAutomations(board.automations);
  }

  const openAutomation = automations.find((a) => a.id === openId) ?? null;

  return (
    <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-500">
        <span className="font-medium text-foreground">{automations.length} Automatizaciones</span>
        <span className="text-success-strong">{activeCount} Activas</span>
        <span>{inactiveCount} Inactivas</span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar automatización…"
            className={cn(
              "w-full rounded-sm border border-border-strong bg-surface-1 py-2 pl-9 pr-3 text-sm text-foreground outline-none",
              "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
              "placeholder:text-neutral-400 focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100",
            )}
          />
        </div>
        <div className="flex gap-1.5">
          {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-[var(--duration-fast)]",
                filter === f ? "bg-accent-500 text-white" : "bg-surface-2 text-neutral-500 hover:text-foreground",
              )}
            >
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {filtered.map((automation, index) => (
          <AutomationCard
            key={automation.id}
            automation={automation}
            index={index}
            onToggle={(enabled) => handleToggle(automation, enabled)}
            onOpen={() => setOpenId(automation.id)}
          />
        ))}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-neutral-400">
        Cada una: prendé/apagá · elegí canal (WhatsApp/correo) · editá el mensaje. Con textos por defecto ya listos.
      </p>

      {openAutomation && (
        <AutomationDrawer
          key={openAutomation.id}
          automation={openAutomation}
          open={Boolean(openAutomation)}
          onClose={() => setOpenId(null)}
          onUpdated={() => refresh()}
        />
      )}
    </div>
  );
}
