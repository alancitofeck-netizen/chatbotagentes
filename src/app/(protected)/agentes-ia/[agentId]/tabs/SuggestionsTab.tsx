"use client";

import { useEffect, useState, useTransition } from "react";
import { Sparkles, RefreshCw, Check, X, Pencil, ThumbsUp, AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/toast/toast";
import { getAgentSuggestionsAction, generateAgentSuggestionsAction, reviewAgentSuggestionAction } from "@/lib/ai-agents/actions";
import type { AgentSuggestion } from "@/lib/ai-agents/suggestions";

const KIND_META = {
  strength: { label: "Fortalezas", icon: ThumbsUp, className: "border-success-strong/30 bg-success-bg" },
  opportunity: { label: "Oportunidades", icon: AlertTriangle, className: "border-warning-strong/30 bg-warning-bg" },
  pattern: { label: "Patrones", icon: TrendingUp, className: "border-info-strong/30 bg-info-bg" },
} as const;

type ReviewFn = (id: string, decision: "accept" | "reject", editedValue?: string) => Promise<void>;

function SuggestionCard({ suggestion, onReview }: { suggestion: AgentSuggestion; onReview: ReviewFn }) {
  const meta = KIND_META[suggestion.kind];
  const Icon = meta.icon;
  const [editing, setEditing] = useState(false);
  const [editedText, setEditedText] = useState(() => {
    if (suggestion.field === "rules") return (suggestion.proposedValue?.newRule as string | undefined) ?? "";
    if (suggestion.field === "prompt") return (suggestion.proposedValue?.systemPrompt as string | undefined) ?? "";
    return "";
  });
  const [isPending, startTransition] = useTransition();

  const isActionable = suggestion.kind === "opportunity" && Boolean(suggestion.field);
  const isReviewed = suggestion.status !== "pending";

  function handle(decision: "accept" | "reject", withEdit: boolean) {
    startTransition(async () => {
      try {
        await onReview(suggestion.id, decision, withEdit ? editedText : undefined);
        setEditing(false);
      } catch {
        // El toast de error ya lo muestra onReview — acá solo se evita que
        // el rechazo de la promesa quede "unhandled".
      }
    });
  }

  return (
    <div className={`rounded-lg border p-3 ${meta.className}`}>
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-semibold text-foreground">{suggestion.title}</p>
            {isReviewed && (
              <Badge variant={suggestion.status === "accepted" ? "success" : "neutral"}>{suggestion.status === "accepted" ? "Aplicado" : "Rechazado"}</Badge>
            )}
          </div>
          <p className="mt-0.5 text-[13px] text-neutral-700">{suggestion.body}</p>

          {isActionable && (
            <>
              {suggestion.field === "tools" && (
                <p className="mt-2 text-[13px] text-neutral-600">→ Desactivar &quot;{suggestion.proposedValue?.toolName as string}&quot;</p>
              )}

              {suggestion.field !== "tools" && !editing && (
                <p className="mt-2 whitespace-pre-wrap rounded-md bg-surface-1 p-2 text-[13px] text-foreground">
                  {suggestion.field === "rules" ? (suggestion.proposedValue?.newRule as string) : (suggestion.proposedValue?.systemPrompt as string)}
                </p>
              )}

              {editing && (
                <textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  rows={suggestion.field === "prompt" ? 10 : 3}
                  className="mt-2 w-full rounded-md border border-border-strong bg-surface-1 p-2 text-[13px] text-foreground outline-none focus:border-accent-500"
                />
              )}

              {!isReviewed && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {editing ? (
                    <>
                      <Button size="sm" onClick={() => handle("accept", true)} loading={isPending}>
                        <Check className="size-3.5" aria-hidden="true" />
                        Guardar y aplicar
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditing(false)} disabled={isPending}>
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" onClick={() => handle("accept", false)} loading={isPending}>
                        <Check className="size-3.5" aria-hidden="true" />
                        Aceptar
                      </Button>
                      {suggestion.field !== "tools" && (
                        <Button size="sm" variant="secondary" onClick={() => setEditing(true)} disabled={isPending}>
                          <Pencil className="size-3.5" aria-hidden="true" />
                          Editar
                        </Button>
                      )}
                      <Button size="sm" variant="destructive" onClick={() => handle("reject", false)} loading={isPending}>
                        <X className="size-3.5" aria-hidden="true" />
                        Rechazar
                      </Button>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Fase 11 — mismo patrón que AdvisorProfileTab (Fase 9): fetch propio vía
 * Server Action al montar, "Generar sugerencias" es el único disparador de
 * OpenRouter. Las Oportunidades son las únicas con Aceptar/Editar/Rechazar
 * (Fortalezas/Patrones son solo informativas) — aceptar SIEMPRE pasa por
 * las Server Actions reales del agente (updateAiAgentPersonality/
 * toggleAgentTool/createAgentPromptVersion), nunca se auto-aplica nada. */
export function SuggestionsTab({ agentId }: { agentId: string }) {
  const [suggestions, setSuggestions] = useState<AgentSuggestion[] | undefined>(undefined);
  const [isGenerating, startGenerate] = useTransition();

  useEffect(() => {
    getAgentSuggestionsAction(agentId).then(setSuggestions);
  }, [agentId]);

  function handleGenerate() {
    startGenerate(async () => {
      try {
        const result = await generateAgentSuggestionsAction(agentId);
        setSuggestions(result);
        toast.success("Análisis actualizado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo generar el análisis.");
      }
    });
  }

  const handleReview: ReviewFn = async (id, decision, editedValue) => {
    try {
      await reviewAgentSuggestionAction(id, decision, editedValue);
      setSuggestions((prev) => prev?.map((s) => (s.id === id ? { ...s, status: decision === "accept" ? "accepted" : "rejected" } : s)));
      toast.success(decision === "accept" ? "Cambio aplicado." : "Sugerencia rechazada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo procesar la sugerencia.");
      throw err;
    }
  };

  const strengths = suggestions?.filter((s) => s.kind === "strength") ?? [];
  const opportunities = suggestions?.filter((s) => s.kind === "opportunity") ?? [];
  const patterns = suggestions?.filter((s) => s.kind === "pattern") ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Análisis IA"
          action={
            <Button size="sm" onClick={handleGenerate} loading={isGenerating}>
              {suggestions && suggestions.length > 0 ? <RefreshCw className="size-4" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
              {suggestions && suggestions.length > 0 ? "Volver a analizar" : "Generar sugerencias"}
            </Button>
          }
        />
        <p className="text-sm text-neutral-500">
          Analiza el desempeño real de este agente (conversaciones, herramientas, conversión de referidos) y sugiere cambios
          concretos — nunca se aplican solos, vos elegís Aceptar, Editar o Rechazar cada uno.
        </p>
      </Card>

      {suggestions === undefined ? (
        <p className="text-sm text-neutral-500">Cargando…</p>
      ) : suggestions.length === 0 ? (
        <EmptyState icon={Sparkles} title="Todavía no se generó ningún análisis" description="Apretá “Generar sugerencias” para analizar el desempeño real de este agente." />
      ) : (
        <>
          {strengths.length > 0 && (
            <Card>
              <CardHeader title="Fortalezas" />
              <div className="flex flex-col gap-2.5">
                {strengths.map((s) => (
                  <SuggestionCard key={s.id} suggestion={s} onReview={handleReview} />
                ))}
              </div>
            </Card>
          )}
          {opportunities.length > 0 && (
            <Card>
              <CardHeader title="Oportunidades" />
              <div className="flex flex-col gap-2.5">
                {opportunities.map((s) => (
                  <SuggestionCard key={s.id} suggestion={s} onReview={handleReview} />
                ))}
              </div>
            </Card>
          )}
          {patterns.length > 0 && (
            <Card>
              <CardHeader title="Patrones" />
              <div className="flex flex-col gap-2.5">
                {patterns.map((s) => (
                  <SuggestionCard key={s.id} suggestion={s} onReview={handleReview} />
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
