"use client";

import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Film } from "lucide-react";
import type { ManychatContentStat } from "@/lib/integrations/manychat";

/** ManyChat → Contenido — solo existe para leads donde el usuario configuró
 * a mano `content_name` en su flujo (ManyChat no lo manda solo, ver nota en
 * ManychatWebhookPayload). Si nunca se configuró, se explica cómo hacerlo
 * en vez de mostrar una tabla vacía sin contexto. */
export function ContenidoTab({ connected, contentStats, onGoToConfig }: { connected: boolean; contentStats: ManychatContentStat[]; onGoToConfig: () => void }) {
  if (!connected) {
    return (
      <EmptyState icon={Film} title="ManyChat todavía no está conectado" description="Conectalo desde Configuración para ver el rendimiento de tu contenido." action={<Button onClick={onGoToConfig}>Ir a Configuración</Button>} />
    );
  }

  if (contentStats.length === 0) {
    return (
      <EmptyState
        icon={Film}
        title="Todavía no hay contenido identificado"
        description={
          "ManyChat no manda automáticamente de qué Reel/Story vino un lead — tenés que agregarlo vos a mano, como texto fijo, en el JSON del paso " +
          "\"External Request\" de cada automatización (una por Reel/Story). Por ejemplo: {\"content_name\":\"5 errores que cometen los agentes\",\"source\":\"reel\"}."
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Top contenido" />
        <p className="mb-3 text-sm text-neutral-500">Ordenado por cantidad de leads generados — solo contenido con nombre configurado en ManyChat.</p>
        <div className="flex flex-col gap-2">
          {contentStats.map((c, i) => (
            <div key={c.contentName} className="flex items-center justify-between gap-3 rounded-md border border-border-default px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-semibold text-neutral-600">{i + 1}</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{c.contentName}</p>
                  {c.source && (
                    <Badge variant="accent" className="mt-1 capitalize">
                      {c.source}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-4 text-center text-xs text-neutral-500">
                <div>
                  <p className="font-mono text-sm font-semibold text-foreground">{c.leadCount}</p>
                  <p>Leads</p>
                </div>
                <div>
                  <p className="font-mono text-sm font-semibold text-foreground">{c.conversationCount}</p>
                  <p>Conversaciones</p>
                </div>
                <div>
                  <p className="font-mono text-sm font-semibold text-success-strong">{c.highInteractionCount}</p>
                  <p>Alta interacción</p>
                </div>
                <div>
                  <p className="font-mono text-sm font-semibold text-foreground">{c.avgScore}</p>
                  <p>Score prom.</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
