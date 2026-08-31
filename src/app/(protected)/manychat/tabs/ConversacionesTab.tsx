"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { MessagesSquare } from "lucide-react";
import type { ManychatLeadListItem } from "@/lib/integrations/manychat";

const LEVEL_VARIANT: Record<string, "neutral" | "warning" | "info" | "success"> = { none: "neutral", low: "warning", medium: "info", high: "success" };

function formatDuration(startIso: string, endIso: string): string {
  const minutes = Math.max(0, Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60_000));
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

/** ManyChat → Conversaciones — a diferencia de Leads (todo contacto con
 * algún evento), esto muestra solo los que tuvieron intercambio real en
 * ambos sentidos (lead respondió Y ManyChat mandó algo) — la misma
 * distinción real que ya usa el Resumen ("Conversaciones" vs "Leads
 * totales"). */
export function ConversacionesTab({
  connected,
  leads,
  onSelectLead,
  onGoToConfig,
}: {
  connected: boolean;
  leads: ManychatLeadListItem[];
  onSelectLead: (contactId: string) => void;
  onGoToConfig: () => void;
}) {
  const conversations = useMemo(
    () => leads.filter((l) => l.leadMessageCount > 0 && l.manychatMessageCount > 0).sort((a, b) => new Date(b.lastInteractionAt).getTime() - new Date(a.lastInteractionAt).getTime()),
    [leads],
  );

  if (!connected) {
    return (
      <EmptyState icon={MessagesSquare} title="ManyChat todavía no está conectado" description="Conectalo desde Configuración para ver conversaciones reales." action={<Button onClick={onGoToConfig}>Ir a Configuración</Button>} />
    );
  }

  if (conversations.length === 0) {
    return <EmptyState icon={MessagesSquare} title="Todavía no hay conversaciones con intercambio real" description="Van a aparecer acá los leads que respondieron y recibieron respuesta de ManyChat." />;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {conversations.map((c) => (
        <Card key={c.contactId} className="cursor-pointer transition-shadow hover:shadow-[var(--elevation-lg)]" onClick={() => onSelectLead(c.contactId)}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="truncate text-sm font-medium text-foreground">{c.name}</p>
            <Badge variant={LEVEL_VARIANT[c.interactionLevel]}>{c.interactionLevel}</Badge>
          </div>
          {c.instagramUsername && <p className="mb-2 text-xs text-neutral-500">@{c.instagramUsername}</p>}
          <div className="grid grid-cols-3 gap-2 border-t border-border-default pt-2 text-center">
            <div>
              <p className="font-mono text-sm font-semibold text-foreground">{c.leadMessageCount}</p>
              <p className="text-[11px] text-neutral-500">Del lead</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold text-foreground">{c.manychatMessageCount}</p>
              <p className="text-[11px] text-neutral-500">ManyChat</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold text-foreground">{formatDuration(c.firstInteractionAt, c.lastInteractionAt)}</p>
              <p className="text-[11px] text-neutral-500">Duración</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
