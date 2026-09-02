"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { CHANNEL_LABEL, CHANNEL_ICON, type Channel } from "@/lib/crm/channels";

export interface ChannelConnectionStatus {
  whatsapp: boolean;
  instagram: boolean;
  /** Mini Apps ya ingesta contactos hoy sin necesitar una conexión OAuth —
   * siempre true, no es un booleano que pueda "desconectarse" desde acá. */
  web: boolean;
}

const REAL_CHANNELS: { channel: Channel; connected: (s: ChannelConnectionStatus) => boolean }[] = [
  { channel: "whatsapp", connected: (s) => s.whatsapp },
  { channel: "instagram", connected: (s) => s.instagram },
  { channel: "web", connected: () => true },
];

/** Tira compacta "Canales conectados" — nunca inventa un estado: cada badge
 * sale de integration_connections vía los getters ya reales del módulo de
 * Integraciones (getWhatsAppIntegration/getInstagramStatus/getManychatStatus,
 * ver src/app/(protected)/crm/page.tsx). "+ Conectar canal" no reimplementa
 * ningún flujo de OAuth acá — linkea al lugar real donde ya existen
 * (/profile?tab=integrations); TikTok se muestra deshabilitado porque no
 * hay ninguna integración real que lo respalde todavía. */
export function ConnectedChannelsPanel({ status }: { status: ChannelConnectionStatus }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
        <span className="font-medium text-neutral-600">Canales conectados:</span>
        {REAL_CHANNELS.map(({ channel, connected }) => {
          const Icon = CHANNEL_ICON[channel];
          const isConnected = connected(status);
          return (
            <span key={channel} className="flex items-center gap-1">
              <Icon className="size-3.5" aria-hidden="true" />
              {CHANNEL_LABEL[channel]}
              <span className={`size-1.5 rounded-full ${isConnected ? "bg-success" : "bg-neutral-300"}`} title={isConnected ? "Conectado" : "No conectado"} />
            </span>
          );
        })}
        <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1 font-medium text-accent-600 hover:underline">
          <Plus className="size-3.5" aria-hidden="true" />
          Conectar canal
        </button>
      </div>

      <Sheet open={open} onClose={() => setOpen(false)} title="Conectar canal">
        <div className="flex flex-col gap-3 p-5">
          {REAL_CHANNELS.map(({ channel, connected }) => {
            const Icon = CHANNEL_ICON[channel];
            const isConnected = connected(status);
            return (
              <div key={channel} className="flex items-center justify-between gap-3 rounded-lg border border-border-default p-3">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Icon className="size-4 text-neutral-500" aria-hidden="true" />
                  {CHANNEL_LABEL[channel]}
                </span>
                {isConnected ? (
                  <span className="text-xs font-medium text-success-strong">Conectado</span>
                ) : channel === "web" ? (
                  <span className="text-xs font-medium text-success-strong">Activo</span>
                ) : (
                  <Link href="/profile?tab=integrations" className="text-xs font-medium text-accent-600 hover:underline">
                    Conectar →
                  </Link>
                )}
              </div>
            );
          })}
          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border-default p-3 opacity-60">
            <span className="text-sm font-medium text-neutral-500">TikTok</span>
            <span className="text-xs text-neutral-400">No disponible aún</span>
          </div>
        </div>
      </Sheet>
    </>
  );
}
