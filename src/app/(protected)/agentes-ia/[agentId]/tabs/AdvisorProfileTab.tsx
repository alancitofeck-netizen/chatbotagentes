"use client";

import { useEffect, useState, useTransition } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/toast/toast";
import { getAdvisorProfileAction, analyzeAdvisorAction } from "@/lib/ai-agents/actions";
import type { AdvisorProfile } from "@/lib/ai-agents/advisorProfile";

const LABELED_ROWS: { key: keyof AdvisorProfile; label: string }[] = [
  { key: "communicationStyle", label: "Estilo de comunicación" },
  { key: "tone", label: "Tono" },
  { key: "messageLength", label: "Longitud de mensajes" },
  { key: "emojiUsage", label: "Uso de emojis" },
  { key: "questioningStyle", label: "Preguntas" },
  { key: "objectionHandling", label: "Manejo de objeciones" },
  { key: "followUpStyle", label: "Estilo de seguimiento" },
  { key: "appointmentStyle", label: "Cómo propone la cita" },
];

/** Fase 9 — analiza las conversaciones REALES del asesor (nunca inventadas:
 * si no hay suficientes mensajes, la Server Action tira un error explícito
 * en vez de fabricar un perfil) y muestra el resultado. El perfil se suma
 * al contexto real del agente en agentRuntime.ts, siempre como "estilo a
 * imitar", nunca como regla que pueda relajar la Fase 5 (reglas del
 * agente) ni las reglas de seguridad. */
export function AdvisorProfileTab({ agentId }: { agentId: string }) {
  const [profile, setProfile] = useState<AdvisorProfile | null | undefined>(undefined);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getAdvisorProfileAction(agentId).then(setProfile);
  }, [agentId]);

  function handleAnalyze() {
    startTransition(async () => {
      try {
        const result = await analyzeAdvisorAction(agentId);
        setProfile(result);
        toast.success(`Perfil actualizado — ${result.analyzedMessageCount} mensajes analizados.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo analizar al asesor.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Perfil del asesor"
          action={
            <Button size="sm" onClick={handleAnalyze} loading={isPending}>
              {profile ? <RefreshCw className="size-4" aria-hidden="true" /> : <Sparkles className="size-4" aria-hidden="true" />}
              {profile ? "Volver a analizar" : "Analizar asesor"}
            </Button>
          }
        />
        <p className="text-sm text-neutral-500">
          Analiza los mensajes reales que este asesor ya escribió por WhatsApp para aprender su estilo — el agente lo usa como
          referencia de tono, nunca puede modificar sus propias reglas de seguridad con esto.
        </p>
      </Card>

      {profile === undefined ? (
        <p className="text-sm text-neutral-500">Cargando…</p>
      ) : profile === null ? (
        <EmptyState
          icon={Sparkles}
          title="Todavía no se analizó a este asesor"
          description="Apretá “Analizar asesor” para generar un perfil a partir de sus conversaciones reales de WhatsApp."
        />
      ) : (
        <>
          <Card>
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs text-neutral-500">
                Analizado el {new Date(profile.analyzedAt ?? "").toLocaleString("es")} — {profile.analyzedMessageCount} mensajes reales
              </p>
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              {LABELED_ROWS.map(({ key, label }) => {
                const value = profile[key];
                if (!value || typeof value !== "string") return null;
                return (
                  <div key={key}>
                    <dt className="text-xs text-neutral-500">{label}</dt>
                    <dd className="text-sm font-medium text-foreground">{value}</dd>
                  </div>
                );
              })}
            </dl>
          </Card>

          {profile.salesProcess.length > 0 && (
            <Card>
              <CardHeader title="Proceso de venta habitual" />
              <ol className="flex flex-col gap-2">
                {profile.salesProcess.map((step, i) => (
                  <li key={i} className="flex items-center gap-2.5 text-sm text-foreground">
                    <Badge variant="accent">{i + 1}</Badge>
                    {step}
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {profile.learnedPatterns.length > 0 && (
            <Card>
              <CardHeader title="Patrones encontrados" />
              <ul className="flex flex-col gap-2">
                {profile.learnedPatterns.map((pattern, i) => (
                  <li key={i} className="text-sm text-neutral-600">
                    • {pattern}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
