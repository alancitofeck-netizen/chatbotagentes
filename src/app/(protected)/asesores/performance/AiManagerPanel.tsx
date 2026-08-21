"use client";

import { useEffect, useState, useTransition } from "react";
import { Bot, AlertTriangle, TrendingUp, Info, RefreshCw, Send, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { getCachedAiManagerInsightsAction, generateAiManagerInsightsAction, askGrowthAiAction, type AiInsightCard } from "@/lib/kpis/aiManager/actions";

const TYPE_META: Record<AiInsightCard["type"], { icon: typeof AlertTriangle; className: string }> = {
  atencion: { icon: AlertTriangle, className: "border-error-strong/30 bg-error-bg" },
  oportunidad: { icon: TrendingUp, className: "border-success-strong/30 bg-success-bg" },
  tendencia: { icon: Info, className: "border-info-strong/30 bg-info-bg" },
};

/** Panel "AI Manager" — solo LEE el caché al montar/cambiar de período
 * (nunca dispara OpenRouter automáticamente); "Actualizar análisis" es el
 * único botón que genera un análisis nuevo. "Preguntale a Growth AI" es una
 * pregunta-respuesta puntual, sin historial persistido. */
export function AiManagerPanel({ periodMonth, weekNumber }: { periodMonth: string; weekNumber?: number }) {
  const [cards, setCards] = useState<AiInsightCard[]>([]);
  const [generatedAt, setGeneratedAt] = useState("");
  const [cached, setCached] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [regenerating, setRegenerating] = useState(false);

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [askError, setAskError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    startTransition(async () => {
      setAnswer(null);
      setAskError(null);
      const result = await getCachedAiManagerInsightsAction(periodMonth, weekNumber);
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setLoadError(null);
      setCards(result.cards);
      setGeneratedAt(result.generatedAt);
      setCached(result.cached);
    });
  }, [periodMonth, weekNumber]);

  async function handleRegenerate() {
    setRegenerating(true);
    setLoadError(null);
    const result = await generateAiManagerInsightsAction(periodMonth, weekNumber);
    setRegenerating(false);
    if (!result.ok) {
      setLoadError(result.error);
      return;
    }
    setCards(result.cards);
    setGeneratedAt(result.generatedAt);
    setCached(false);
  }

  async function handleAsk() {
    if (!question.trim()) return;
    setAsking(true);
    setAskError(null);
    setAnswer(null);
    const result = await askGrowthAiAction(question, periodMonth, weekNumber);
    setAsking(false);
    if (!result.ok) {
      setAskError(result.error);
      return;
    }
    setAnswer(result.answer);
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-[15px] font-medium text-inherit">
          <Bot className="size-4 text-accent-600" aria-hidden="true" />
          AI Manager
        </h3>
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={regenerating}
          className="flex items-center gap-1.5 rounded-full border border-border-default px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-2 disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${regenerating ? "animate-spin" : ""}`} aria-hidden="true" />
          Actualizar análisis
        </button>
      </div>

      {isPending && cards.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Cargando análisis…
        </p>
      ) : loadError ? (
        <p className="text-sm text-error-strong">{loadError}</p>
      ) : cards.length === 0 ? (
        <p className="text-sm text-neutral-500">Todavía no hay un análisis generado para este período. Tocá &quot;Actualizar análisis&quot;.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {cards.map((card) => {
            const meta = TYPE_META[card.type];
            const Icon = meta.icon;
            return (
              <div key={card.id} className={`rounded-lg border p-3 ${meta.className}`}>
                <div className="flex items-start gap-2">
                  <Icon className="mt-0.5 size-4 shrink-0 text-foreground" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-foreground">
                      {card.title}
                      {card.agentName && <span className="ml-1.5 font-normal text-neutral-500">· {card.agentName}</span>}
                    </p>
                    <p className="mt-0.5 text-[13px] text-neutral-700">{card.body}</p>
                    {card.recommendation && <p className="mt-1 text-[13px] font-medium text-foreground">→ {card.recommendation}</p>}
                  </div>
                </div>
              </div>
            );
          })}
          {generatedAt && (
            <p className="text-[11px] text-neutral-400">
              {cached ? "Análisis guardado" : "Análisis generado"} el {new Date(generatedAt).toLocaleString("es")}
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-border-default pt-3">
        <p className="text-[13px] font-medium text-foreground">Preguntale a Growth AI</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAsk();
            }}
            placeholder="¿Quién tuvo la mejor conversión esta semana?"
            className="min-w-0 flex-1 rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
          <button
            type="button"
            onClick={handleAsk}
            disabled={asking || !question.trim()}
            aria-label="Preguntar"
            className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-accent-500 text-white disabled:opacity-40"
          >
            {asking ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Send className="size-4" aria-hidden="true" />}
          </button>
        </div>
        {askError && <p className="text-[13px] text-error-strong">{askError}</p>}
        {answer && <p className="rounded-lg bg-surface-2 p-3 text-[13px] text-foreground">{answer}</p>}
      </div>
    </Card>
  );
}
