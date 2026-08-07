"use client";

import { useMemo, useState } from "react";
import { Search, Plus, CheckCircle2, XCircle, Wand2, Play } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { toast } from "@/components/toast/toast";
import { cn } from "@/lib/utils/cn";
import { AUTOMATION_CATEGORIES } from "@/lib/automationTemplates/constants";
import { getAutomationsBoardAction, updateAutomationAction, type AutomationsBoardResult } from "@/lib/automationTemplates/actions";
import type { AutomationTemplate } from "@/lib/automationTemplates/queries";
import { AutomationCard } from "./AutomationCard";
import { AutomationDrawer } from "./AutomationDrawer";
import { MyAutomationsTab } from "./MyAutomationsTab";
import { HistoryTab } from "./HistoryTab";

type Tab = "library" | "mine" | "history";
type CategoryFilter = "Todas" | (typeof AUTOMATION_CATEGORIES)[number];

function StatTile({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">{icon}</span>
      <div>
        <p className="font-mono text-xl font-semibold leading-none text-foreground">{value}</p>
        <p className="mt-1 text-[13px] text-neutral-500">{label}</p>
      </div>
    </div>
  );
}

export function AutomationsShell({ initial }: { initial: AutomationsBoardResult }) {
  const [automations, setAutomations] = useState(initial.automations);
  const [stats, setStats] = useState(initial.stats);
  const [tab, setTab] = useState<Tab>("library");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("Todas");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return automations.filter((a) => {
      if (category !== "Todas" && a.category !== category) return false;
      if (query && !a.name.toLowerCase().includes(query) && !a.description.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [automations, search, category]);

  function patchLocal(key: string, patch: Partial<AutomationTemplate>) {
    setAutomations((prev) => prev.map((a) => (a.key === key ? { ...a, ...patch } : a)));
  }

  async function handleToggle(automation: AutomationTemplate, enabled: boolean) {
    patchLocal(automation.key, { enabled, isCustomized: true });
    try {
      await updateAutomationAction(automation.key, { enabled });
    } catch (err) {
      patchLocal(automation.key, { enabled: automation.enabled });
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar.");
    }
  }

  async function refresh() {
    const board = await getAutomationsBoardAction();
    setAutomations(board.automations);
    setStats(board.stats);
  }

  function handleNewAutomation() {
    setTab("mine");
    setCreateOpen(true);
  }

  const openAutomation = automations.find((a) => a.key === openKey) ?? null;

  return (
    <div className="flex flex-col gap-5 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <Card className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
          <StatTile icon={<CheckCircle2 className="size-[18px]" aria-hidden="true" />} value={stats.activeCount} label="Automatizaciones activas" />
          <StatTile icon={<XCircle className="size-[18px]" aria-hidden="true" />} value={stats.inactiveCount} label="Automatizaciones desactivadas" />
          <StatTile icon={<Wand2 className="size-[18px]" aria-hidden="true" />} value={stats.customCount} label="Automatizaciones personalizadas" />
          <StatTile icon={<Play className="size-[18px]" aria-hidden="true" />} value={stats.executionsThisMonth} label="Ejecuciones este mes" />
        </Card>
        <Button onClick={handleNewAutomation} size="lg" className="shrink-0">
          <Plus className="size-4" aria-hidden="true" />
          Nueva automatización
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="library">📚 Biblioteca</TabsTrigger>
          <TabsTrigger value="mine">⚡ Mis automatizaciones</TabsTrigger>
          <TabsTrigger value="history">📊 Historial</TabsTrigger>
        </TabsList>

        <TabsContent value="library">
          <div className="flex flex-col gap-4 pt-4">
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
              <div className="flex flex-wrap gap-1.5">
                {(["Todas", ...AUTOMATION_CATEGORIES] as CategoryFilter[]).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors duration-[var(--duration-fast)]",
                      category === c ? "bg-accent-500 text-white" : "bg-surface-2 text-neutral-500 hover:text-foreground",
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((automation, index) => (
                <AutomationCard
                  key={automation.key}
                  automation={automation}
                  index={index}
                  onToggle={(enabled) => handleToggle(automation, enabled)}
                  onOpen={() => setOpenKey(automation.key)}
                />
              ))}
            </div>

            <p className="text-xs text-neutral-400">
              Automatizaciones listas por defecto — no se pueden eliminar, solo activar, desactivar o editar su mensaje y canales.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="mine">
          <div className="pt-4">
            <MyAutomationsTab createOpen={createOpen} onCreateOpenChange={setCreateOpen} />
          </div>
        </TabsContent>

        <TabsContent value="history">
          <div className="pt-4">
            <HistoryTab />
          </div>
        </TabsContent>
      </Tabs>

      {openAutomation && (
        <AutomationDrawer key={openAutomation.key} automation={openAutomation} open={Boolean(openAutomation)} onClose={() => setOpenKey(null)} onUpdated={() => refresh()} />
      )}
    </div>
  );
}
