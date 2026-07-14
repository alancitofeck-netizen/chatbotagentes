"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/toast/toast";
import type { AiPromptVersion } from "@/lib/ai-agents/queries";
import { updateAgentPromptDraft, createAgentPromptVersion, activateAgentPrompt, archiveAgentPrompt } from "@/lib/ai-agents/actions";

const STATUS_VARIANT: Record<string, "neutral" | "success" | "warning"> = { draft: "warning", active: "success", archived: "neutral" };
const STATUS_LABEL: Record<string, string> = { draft: "Borrador", active: "Activo", archived: "Archivado" };

/** Duplicado deliberado de agentRuntime.ts::interpolate — ese módulo tiene
 * `import "server-only"`, no se puede importar desde un Client Component. */
function interpolate(template: string, variables: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) result = result.replaceAll(`{{${key}}}`, value);
  return result;
}

export function PromptTab({ agentId, initialPrompts }: { agentId: string; initialPrompts: AiPromptVersion[] }) {
  const [prompts, setPrompts] = useState(initialPrompts);
  const [selectedId, setSelectedId] = useState(initialPrompts[0]?.id ?? null);
  const selected = prompts.find((p) => p.id === selectedId) ?? prompts[0] ?? null;

  const [systemPrompt, setSystemPrompt] = useState(selected?.systemPrompt ?? "");
  const [variablesText, setVariablesText] = useState(() => JSON.stringify(selected?.variables ?? {}, null, 2));
  const [previewValues, setPreviewValues] = useState<Record<string, string>>({});
  const [isPending, startTransition] = useTransition();

  function selectPrompt(p: AiPromptVersion) {
    setSelectedId(p.id);
    setSystemPrompt(p.systemPrompt);
    setVariablesText(JSON.stringify(p.variables, null, 2));
  }

  function parseVariables(): Record<string, string> | null {
    try {
      const parsed = JSON.parse(variablesText || "{}");
      if (typeof parsed !== "object" || Array.isArray(parsed) || parsed === null) throw new Error();
      return parsed as Record<string, string>;
    } catch {
      toast.error("Las variables deben ser un objeto JSON válido, ej: {\"nombre_empresa\": \"Growth Link\"}");
      return null;
    }
  }

  function handleSave() {
    if (!selected) return;
    const variables = parseVariables();
    if (!variables) return;
    startTransition(async () => {
      try {
        await updateAgentPromptDraft(agentId, selected.id, systemPrompt, variables);
        setPrompts((prev) => prev.map((p) => (p.id === selected.id ? { ...p, systemPrompt, variables } : p)));
        toast.success("Prompt guardado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    });
  }

  function handleNewVersion() {
    const variables = parseVariables();
    if (!variables) return;
    startTransition(async () => {
      try {
        await createAgentPromptVersion(agentId, systemPrompt, variables);
        toast.success("Nueva versión creada — recargá para verla en la lista.");
        window.location.reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear la nueva versión.");
      }
    });
  }

  function handleActivate() {
    if (!selected) return;
    startTransition(async () => {
      try {
        await activateAgentPrompt(agentId, selected.id);
        setPrompts((prev) => prev.map((p) => (p.id === selected.id ? { ...p, status: "active" } : p.status === "active" ? { ...p, status: "archived" } : p)));
        toast.success("Prompt activado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo activar.");
      }
    });
  }

  function handleArchive() {
    if (!selected) return;
    startTransition(async () => {
      try {
        await archiveAgentPrompt(agentId, selected.id);
        setPrompts((prev) => prev.map((p) => (p.id === selected.id ? { ...p, status: "archived" } : p)));
        toast.success("Prompt archivado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo archivar.");
      }
    });
  }

  const isDraft = selected?.status === "draft";
  const usedVariableKeys = Array.from(systemPrompt.matchAll(/\{\{(\w+)\}\}/g)).map((m) => m[1]);
  const uniqueVariableKeys = Array.from(new Set(usedVariableKeys));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
      <Card>
        <CardHeader title="Versiones" />
        <ul className="flex flex-col gap-1">
          {prompts.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => selectPrompt(p)}
                className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm ${p.id === selected?.id ? "bg-surface-2 text-foreground" : "text-neutral-500 hover:bg-surface-2"}`}
              >
                v{p.version}
                <Badge variant={STATUS_VARIANT[p.status]}>{STATUS_LABEL[p.status]}</Badge>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      {selected && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title={`Prompt de sistema — v${selected.version}`} />
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              readOnly={!isDraft}
              rows={12}
              className="w-full rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100 read-only:cursor-not-allowed read-only:opacity-60"
            />
            {!isDraft && <p className="mt-1.5 text-xs text-neutral-500">Este prompt está {STATUS_LABEL[selected.status].toLowerCase()} — creá una nueva versión para editarlo.</p>}

            <div className="mt-3 flex flex-wrap gap-2">
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
              {selected.status !== "archived" && (
                <Button size="sm" variant="destructive" onClick={handleArchive} loading={isPending}>
                  Archivar
                </Button>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Variables" />
            <p className="mb-2 text-xs text-neutral-500">
              Usá <code>{"{{variable}}"}</code> en el prompt. Detectadas en el texto: {uniqueVariableKeys.length ? uniqueVariableKeys.join(", ") : "ninguna"}.
            </p>
            <textarea
              value={variablesText}
              onChange={(e) => setVariablesText(e.target.value)}
              readOnly={!isDraft}
              rows={4}
              className="w-full rounded-sm border border-border-strong bg-surface-1 px-3 py-2 font-mono text-xs outline-none focus:border-accent-500 read-only:opacity-60"
            />
          </Card>

          <Card>
            <CardHeader title="Vista previa" />
            <div className="flex flex-col gap-3">
              {uniqueVariableKeys.map((key) => (
                <Input
                  key={key}
                  label={key}
                  value={previewValues[key] ?? ""}
                  onChange={(e) => setPreviewValues((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              ))}
              <div className="rounded-md bg-surface-2 p-3">
                <p className="whitespace-pre-wrap text-sm text-foreground">{interpolate(systemPrompt, previewValues)}</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
