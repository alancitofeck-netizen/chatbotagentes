"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { generatePresentationAiContentAction } from "@/lib/presentations/actions";
import { AI_GENERATION_MESSAGES } from "@/lib/presentations/constants";
import type { PresentationSlide } from "@/lib/presentations/constants";

const MESSAGE_INTERVAL_MS = 1500;

export function IaStep({
  presentationId,
  hasContent,
  onGenerated,
}: {
  presentationId: string;
  hasContent: boolean;
  onGenerated: (aiContent: Record<string, unknown>, slides: PresentationSlide[]) => void;
}) {
  const [generating, setGenerating] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!generating) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, AI_GENERATION_MESSAGES.length - 1));
    }, MESSAGE_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [generating]);

  async function handleGenerate() {
    setMessageIndex(0);
    setGenerating(true);
    try {
      const { aiContent, slides } = await generatePresentationAiContentAction(presentationId);
      onGenerated(aiContent, slides);
      toast.success("Contenido generado con IA.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo generar el contenido.");
    } finally {
      setGenerating(false);
    }
  }

  const progressPct = Math.round(((messageIndex + 1) / AI_GENERATION_MESSAGES.length) * 100);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Generación con IA</h2>
        <p className="text-sm text-neutral-500">La IA genera automáticamente tu biografía, propuesta de valor, diferenciales, FAQs y más.</p>
      </div>

      {generating ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border-default bg-surface-2 p-10">
          <Sparkles className="size-8 animate-pulse text-accent-500" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">{AI_GENERATION_MESSAGES[messageIndex]}</p>
          <div className="h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-surface-3">
            <div className="h-full rounded-full bg-accent-500 transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border-default bg-surface-2 p-10 text-center">
          {hasContent ? (
            <>
              <p className="text-sm text-neutral-500">Ya generaste contenido con IA — podés volver a generarlo si cambiaste tu información.</p>
              <Button size="lg" variant="secondary" onClick={handleGenerate}>
                <RefreshCw className="size-4" aria-hidden="true" />
                Volver a generar con IA
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-neutral-500">Vas a poder editar todo el contenido en el siguiente paso.</p>
              <Button size="lg" onClick={handleGenerate}>
                <Sparkles className="size-4" aria-hidden="true" />
                ✨ Generar con IA
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
