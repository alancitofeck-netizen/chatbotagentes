"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Mail, Sheet as SheetIcon, HardDrive, Cloud } from "lucide-react";
import type { SyncStatus } from "@/lib/dataTransfer/actions";

function SyncRow({
  icon: Icon,
  name,
  connected,
  detail,
  onConnect,
}: {
  icon: typeof Mail;
  name: string;
  connected: boolean | null; // null = no existe todavía (Próximamente)
  detail?: string | null;
  onConnect?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border-default bg-surface-1 p-3.5">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">{name}</p>
          {detail && <p className="text-xs text-neutral-500">{detail}</p>}
        </div>
      </div>
      {connected === null ? (
        <Badge variant="neutral">Próximamente</Badge>
      ) : connected ? (
        <div className="flex items-center gap-2">
          <Badge variant="success" dot>
            Conectado
          </Badge>
        </div>
      ) : (
        <Button size="sm" variant="secondary" onClick={onConnect} data-tour="data-transfer.sync-connect">
          Conectar
        </Button>
      )}
    </div>
  );
}

/** Google Sheets/Drive tienen OAuth real hoy (integration_connections) — el
 * resto (Outlook, Google Contacts, Dropbox, OneDrive) no tiene backend
 * todavía, se muestran honestamente como "Próximamente" en vez de un botón
 * "Conectar" que no llevaría a ningún lado (mismo criterio que Aseguradoras
 * con Portal Web/API). */
export function SyncCenter({ sync }: { sync: SyncStatus }) {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-foreground">Sincronización</p>
        <p className="text-[13px] text-neutral-500">Conectá tus otras herramientas — se administra desde Perfil → Integraciones</p>
      </div>
      <div className="flex flex-col gap-2">
        <SyncRow
          icon={SheetIcon}
          name="Google Sheets"
          connected={sync.googleSheets.connected}
          detail={sync.googleSheets.email ?? "Importar/Exportar/Sincronización automática"}
          onConnect={() => {
            window.location.href = "/profile?tab=integrations";
          }}
        />
        <SyncRow
          icon={HardDrive}
          name="Google Drive"
          connected={sync.googleDrive.connected}
          detail={sync.googleDrive.email ?? "Guardar automáticamente exportaciones y backups"}
          onConnect={() => {
            window.location.href = "/profile?tab=integrations";
          }}
        />
        <SyncRow icon={Mail} name="Outlook" connected={null} detail="Google Contacts / Outlook" />
        <SyncRow icon={Cloud} name="Dropbox" connected={null} detail="Guardar respaldos" />
        <SyncRow icon={Cloud} name="OneDrive" connected={null} detail="Guardar respaldos" />
      </div>
    </Card>
  );
}
