"use client";

import { useState } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { analyzeAdvisorySessionAction } from "@/lib/advisorySessions/actions";
import type { AdvisorySessionAnalysis } from "@/lib/advisorySessions/aiAnalysis";

export function AiAnalysisStep({
  sessionId,
  analysis,
  onAnalyzed,
}: {
  sessionId: string;
  analysis: AdvisorySessionAnalysis | null;
  onAnalyzed: (analysis: AdvisorySessionAnalysis) => void;
}) {
  const [analyzing, setAnalyzing] = useState(false);

  function handleAnalyze() {
    setAnalyzing(true);
    analyzeAdvisorySessionAction(sessionId)
      .then(onAnalyzed)
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo analizar la asesoría."))
      .finally(() => setAnalyzing(false));
  }

  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold text-foreground">Análisis IA</h2>
      <p className="mb-4 text-sm text-neutral-500">La IA lee todo lo respondido hasta acá y te sugiere cómo seguir la conversación.</p>

      {!analysis && !analyzing && (
        <div className="flex flex-col items-center gap-3 rounded-lg bg-surface-2 p-8 text-center">
          <Sparkles className="size-6 text-accent-500" aria-hidden="true" />
          <p className="text-sm text-neutral-500">Perfil, riesgos, productos recomendados, oportunidades y objeciones — generado a partir de las respuestas reales.</p>
          <Button onClick={handleAnalyze}>
            <Sparkles className="size-4" aria-hidden="true" />
            Analizar con IA
          </Button>
        </div>
      )}

      {analyzing && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <Loader2 className="size-6 animate-spin text-accent-500" aria-hidden="true" />
          <p className="text-sm text-neutral-500">Analizando…</p>
        </div>
      )}

      {analysis && !analyzing && (
        <div className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Perfil del cliente</p>
            <p className="mt-1 text-sm text-foreground">{analysis.summary}</p>
          </div>

          {analysis.risks.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Riesgos detectados</p>
              <ul className="mt-1 flex flex-col gap-1">
                {analysis.risks.map((r, i) => (
                  <li key={i} className="rounded-md bg-warning-bg p-2 text-sm text-warning-strong">
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.recommendedProducts.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Productos recomendados</p>
              <div className="mt-1 flex flex-wrap gap-2">
                {analysis.recommendedProducts.map((p, i) => (
                  <span key={i} className="rounded-full bg-accent-100 px-3 py-1 text-xs font-medium text-accent-700">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.opportunities.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Oportunidades</p>
              <ul className="mt-1 flex flex-col gap-1">
                {analysis.opportunities.map((o, i) => (
                  <li key={i} className="rounded-md bg-surface-2 p-2 text-sm text-foreground">
                    {o}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.objections.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Objeciones posibles — respuestas sugeridas</p>
              <ul className="mt-1 flex flex-col gap-2">
                {analysis.objections.map((o, i) => (
                  <li key={i} className="rounded-md border border-border-default p-3">
                    <p className="text-sm font-medium text-foreground">{o.objection}</p>
                    <p className="mt-1 text-sm text-neutral-500">{o.suggestedResponse}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Button variant="secondary" size="sm" onClick={handleAnalyze} className="self-start">
            Volver a analizar
          </Button>
        </div>
      )}
    </div>
  );
}
