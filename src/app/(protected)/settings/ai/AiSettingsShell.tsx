"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AiPrompt, AiTool } from "@/lib/ai-settings/queries";
import { getPromptsAction } from "@/lib/ai-settings/actions";
import { CreatePromptSheet } from "./CreatePromptSheet";
import { PromptDetailSheet } from "./PromptDetailSheet";

const STATUS_VARIANT: Record<string, "neutral" | "success" | "warning"> = {
  draft: "warning",
  active: "success",
  archived: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Borrador",
  active: "Activo",
  archived: "Archivado",
};

export function AiSettingsShell({
  initialModuleKey,
  initialPrompts,
  tools,
}: {
  initialModuleKey: "crm" | "ats";
  initialPrompts: AiPrompt[];
  tools: AiTool[];
}) {
  const [moduleKey, setModuleKey] = useState(initialModuleKey);
  const [prompts, setPrompts] = useState(initialPrompts);
  const [selected, setSelected] = useState<AiPrompt | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [, startTransition] = useTransition();
  const isFirstRender = useRef(true);

  function refetch(key: "crm" | "ats" = moduleKey) {
    startTransition(async () => {
      setPrompts(await getPromptsAction(key));
    });
  }

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    refetch(moduleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleKey]);

  function handleChanged() {
    refetch();
    setSelected(null);
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <Link href="/settings" className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-foreground">
          <ArrowLeft size={14} aria-hidden="true" />
          Configuración
        </Link>
        <div className="mt-2 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">
              Prompt Builder
            </h1>
            <p className="text-sm text-neutral-500">
              Prompts de sistema versionados y tools asignadas — todavía no se ejecutan (el motor de IA no está
              conectado).
            </p>
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={15} aria-hidden="true" />
            Nuevo prompt
          </Button>
        </div>
      </div>

      <Tabs value={moduleKey} onValueChange={(v) => setModuleKey(v as "crm" | "ats")}>
        <TabsList>
          <TabsTrigger value="crm">CRM</TabsTrigger>
          <TabsTrigger value="ats">ATS</TabsTrigger>
        </TabsList>
      </Tabs>

      {prompts.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Sin prompts todavía"
          description="Creá el primero para este módulo."
        />
      ) : (
        <ul className="flex flex-col rounded-lg border border-border-default">
          {prompts.map((p) => (
            <li key={p.id} className="border-b border-border-default last:border-b-0">
              <button
                type="button"
                onClick={() => setSelected(p)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {p.name} <span className="text-neutral-500">v{p.version}</span>
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[p.status] ?? "neutral"}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}

      <PromptDetailSheet
        key={selected?.id ?? "closed"}
        prompt={selected}
        tools={tools}
        onClose={() => setSelected(null)}
        onChanged={handleChanged}
      />
      <CreatePromptSheet
        open={createOpen}
        moduleKey={moduleKey}
        onClose={() => setCreateOpen(false)}
        onCreated={() => refetch()}
      />
    </div>
  );
}
