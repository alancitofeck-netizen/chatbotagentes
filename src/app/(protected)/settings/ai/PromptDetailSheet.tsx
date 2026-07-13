"use client";

import { useEffect, useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { AiPrompt, AiTool } from "@/lib/ai-settings/queries";
import {
  activatePrompt,
  archivePrompt,
  createPromptVersion,
  getPromptToolIdsAction,
  togglePromptTool,
  updatePromptDraft,
} from "@/lib/ai-settings/actions";

/** `prompt` arrives already loaded from the list — only the tool-assignment
 * checklist needs its own async fetch. The parent (AiSettingsShell) remounts
 * this whole component per selection via `key={selected?.id ?? "closed"}`,
 * so the effect below always starts fresh (same reasoning as
 * ContactDetailPanel's remount fix, src/app/(protected)/contacts). */
export function PromptDetailSheet({
  prompt,
  tools,
  onClose,
  onChanged,
}: {
  prompt: AiPrompt | null;
  tools: AiTool[];
  onClose: () => void;
  onChanged: () => void;
}) {
  if (!prompt) return null;
  return <PromptDetailContent prompt={prompt} tools={tools} onClose={onClose} onChanged={onChanged} />;
}

function PromptDetailContent({
  prompt,
  tools,
  onClose,
  onChanged,
}: {
  prompt: AiPrompt;
  tools: AiTool[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [systemPrompt, setSystemPrompt] = useState(prompt.systemPrompt);
  const [toolIds, setToolIds] = useState<string[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const isDraft = prompt.status === "draft";

  useEffect(() => {
    getPromptToolIdsAction(prompt.id).then(setToolIds);
  }, [prompt.id]);

  function handleSave() {
    startTransition(async () => {
      try {
        await updatePromptDraft(prompt.id, systemPrompt);
        toast.success("Prompt guardado.");
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    });
  }

  function handleNewVersion() {
    startTransition(async () => {
      try {
        await createPromptVersion(prompt.id, { systemPrompt });
        toast.success("Nueva versión creada.");
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear la nueva versión.");
      }
    });
  }

  function handleActivate() {
    startTransition(async () => {
      try {
        await activatePrompt(prompt.id);
        toast.success("Prompt activado.");
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo activar.");
      }
    });
  }

  function handleArchive() {
    startTransition(async () => {
      try {
        await archivePrompt(prompt.id);
        toast.success("Prompt archivado.");
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo archivar.");
      }
    });
  }

  function handleToggleTool(toolId: string, enabled: boolean) {
    startTransition(async () => {
      try {
        await togglePromptTool(prompt.id, toolId, enabled);
        setToolIds((prev) => (enabled ? [...(prev ?? []), toolId] : (prev ?? []).filter((id) => id !== toolId)));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar la tool.");
      }
    });
  }

  return (
    <Sheet open onClose={onClose} title={`${prompt.name} · v${prompt.version}`}>
      <div className="flex flex-col gap-4 p-5">
        <div>
          <label className="text-sm font-medium text-foreground">Prompt de sistema</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            readOnly={!isDraft}
            rows={10}
            className="mt-1.5 w-full rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100 read-only:cursor-not-allowed read-only:opacity-60"
          />
          {!isDraft && (
            <p className="mt-1.5 text-xs text-neutral-500">
              Este prompt está {prompt.status === "active" ? "activo" : "archivado"} — creá una nueva versión para
              editarlo.
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {isDraft && (
            <Button size="sm" onClick={handleSave} loading={isPending}>
              Guardar
            </Button>
          )}
          {isDraft && (
            <Button size="sm" variant="secondary" onClick={handleActivate} loading={isPending}>
              Activar
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={handleNewVersion} loading={isPending}>
            Nueva versión
          </Button>
          {prompt.status !== "archived" && (
            <Button size="sm" variant="destructive" onClick={handleArchive} loading={isPending}>
              Archivar
            </Button>
          )}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">Tools habilitadas</p>
          {toolIds === null ? (
            <p className="text-xs text-neutral-500">Cargando…</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {tools.map((t) => {
                const active = toolIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleToggleTool(t.id, !active)}
                    className="disabled:opacity-50"
                    title={t.description ?? undefined}
                  >
                    <Badge variant={active ? "accent" : "neutral"} className={active ? "" : "opacity-60"}>
                      {t.name}
                    </Badge>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
