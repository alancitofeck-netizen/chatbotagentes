import { Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";

/** Static/decorative — no Agent Runtime/OpenRouter connected yet
 * (docs/blueprint/13-agent-engine.md). Same "don't fake it" posture as the
 * Automatizaciones/Prompt Builder banners — this never pretends to answer. */
export function AiAssistantWidget() {
  return (
    <Card className="flex flex-col items-center gap-3 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-accent-100 text-accent-700">
        <Sparkles className="size-5" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm font-medium text-foreground">Asistente de IA</p>
        <p className="mt-1 text-[13px] text-neutral-500">
          Todavía no conectado — requiere el motor de IA (OpenRouter).
        </p>
      </div>
      <input
        disabled
        placeholder="Preguntame lo que sea…"
        title="Requiere conectar el motor de IA"
        className="w-full cursor-not-allowed rounded-full border border-border-default bg-surface-2 px-4 py-2.5 text-sm text-neutral-400 outline-none"
      />
    </Card>
  );
}
