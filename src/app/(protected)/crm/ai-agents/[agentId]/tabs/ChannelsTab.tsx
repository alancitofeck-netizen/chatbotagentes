"use client";

import { useState, useTransition } from "react";
import { MessageCircle, Share2, Globe } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/toast/toast";
import { updateAiAgentChannels } from "@/lib/ai-agents/actions";

const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle, enabled: true },
  { key: "linkedin", label: "LinkedIn", icon: Share2, enabled: false },
  { key: "instagram", label: "Instagram", icon: Globe, enabled: false },
];

export function ChannelsTab({ agentId, initialChannels }: { agentId: string; initialChannels: string[] }) {
  const [channels, setChannels] = useState(initialChannels);
  const [isPending, startTransition] = useTransition();

  function handleToggle(key: string) {
    const next = channels.includes(key) ? channels.filter((c) => c !== key) : [...channels, key];
    setChannels(next);
    startTransition(async () => {
      try {
        await updateAiAgentChannels(agentId, next);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar los canales.");
        setChannels(channels);
      }
    });
  }

  return (
    <Card>
      <CardHeader title="Canales en los que puede responder" />
      <div className="flex flex-col gap-2">
        {CHANNELS.map(({ key, label, icon: Icon, enabled }) => {
          const active = channels.includes(key);
          return (
            <button
              key={key}
              type="button"
              disabled={!enabled || isPending}
              onClick={() => handleToggle(key)}
              className="flex items-center justify-between gap-3 rounded-md border border-border-default px-3 py-2 text-left hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <div className="flex items-center gap-2">
                <Icon size={16} className="text-neutral-400" aria-hidden="true" />
                <span className="text-sm font-medium text-foreground">{label}</span>
              </div>
              <Badge variant={!enabled ? "neutral" : active ? "accent" : "neutral"}>
                {!enabled ? "Próximamente" : active ? "Habilitado" : "Deshabilitado"}
              </Badge>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
