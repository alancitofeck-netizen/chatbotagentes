"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { MessageCircle, CalendarDays, RefreshCw, Bot, Table2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { OpenRouterIntegration, WhatsAppIntegration } from "@/lib/integrations/queries";
import type { GoogleCalendarStatus } from "@/lib/integrations/googleCalendar";
import type { GoogleSheetsAccountStatus } from "@/lib/integrations/googleSheets";
import {
  disconnectWhatsAppIntegration,
  getWhatsAppIntegrationAction,
  disconnectGoogleCalendarAction,
  syncGoogleCalendarNowAction,
  getOpenRouterIntegrationAction,
  disconnectOpenRouterIntegration,
} from "@/lib/integrations/actions";
import { WhatsAppIntegrationSheet } from "./WhatsAppIntegrationSheet";
import { OpenRouterIntegrationSheet } from "./OpenRouterIntegrationSheet";
import { KpiSettersManager } from "./KpiSettersManager";

/** Moved from the old standalone /settings/integrations page into the
 * Perfil > Integraciones tab — same components/actions, no logic changes. */
export function IntegrationsSection({
  initialWhatsApp,
  initialGoogleCalendar,
  initialOpenRouter,
  initialGoogleSheets,
  currentRole,
}: {
  initialWhatsApp: WhatsAppIntegration | null;
  initialGoogleCalendar: GoogleCalendarStatus;
  initialOpenRouter: OpenRouterIntegration | null;
  initialGoogleSheets: GoogleSheetsAccountStatus;
  currentRole: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [whatsapp, setWhatsapp] = useState(initialWhatsApp);
  const [googleCalendar, setGoogleCalendar] = useState(initialGoogleCalendar);
  const [openRouter, setOpenRouter] = useState(initialOpenRouter);
  const [googleSheets] = useState(initialGoogleSheets);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [openRouterSheetOpen, setOpenRouterSheetOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isSyncing, startSyncTransition] = useTransition();
  const canManage = currentRole === "owner" || currentRole === "admin";
  const isActive = whatsapp?.status === "active";
  const isOpenRouterActive = openRouter?.status === "active";

  // The Google OAuth callback (src/app/api/integrations/google-calendar/callback/route.ts)
  // redirects back here with a result flag in the query string — surface it
  // once, then strip it so a page refresh doesn't re-show the toast.
  useEffect(() => {
    if (searchParams.get("google_calendar_connected")) {
      toast.success("Google Calendar conectado.");
      router.replace("/profile?tab=integrations", { scroll: false });
    } else if (searchParams.get("google_calendar_error")) {
      toast.error("No se pudo conectar Google Calendar.");
      router.replace("/profile?tab=integrations", { scroll: false });
    } else if (searchParams.get("google_sheets_connected")) {
      // No setGoogleSheets here — the OAuth callback route does a real HTTP
      // redirect (not a client transition), so this whole page re-runs
      // server-side first and initialGoogleSheets already reflects
      // connected:true by the time this component mounts.
      toast.success("Cuenta de Google conectada — ahora agregá tus setters abajo.");
      router.replace("/profile?tab=integrations", { scroll: false });
    } else if (searchParams.get("google_sheets_error")) {
      toast.error("No se pudo conectar la cuenta de Google para KPIs.");
      router.replace("/profile?tab=integrations", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function refetch() {
    startTransition(async () => {
      setWhatsapp(await getWhatsAppIntegrationAction());
    });
  }

  function refetchOpenRouter() {
    startTransition(async () => {
      setOpenRouter(await getOpenRouterIntegrationAction());
    });
  }

  function handleDisconnectOpenRouter() {
    if (!window.confirm("¿Desconectar la integración de OpenRouter de este workspace?")) return;
    startTransition(async () => {
      try {
        await disconnectOpenRouterIntegration();
        refetchOpenRouter();
        toast.success("Integración desconectada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo desconectar.");
      }
    });
  }

  function handleDisconnect() {
    if (!window.confirm("¿Desconectar la integración de WhatsApp de este workspace?")) return;
    startTransition(async () => {
      try {
        await disconnectWhatsAppIntegration();
        refetch();
        toast.success("Integración desconectada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo desconectar.");
      }
    });
  }

  function handleDisconnectGoogle() {
    if (!window.confirm("¿Desconectar Google Calendar de este workspace?")) return;
    startTransition(async () => {
      try {
        await disconnectGoogleCalendarAction();
        setGoogleCalendar({ connected: false, email: null });
        toast.success("Google Calendar desconectado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo desconectar.");
      }
    });
  }

  function handleSyncGoogle() {
    startSyncTransition(async () => {
      try {
        const result = await syncGoogleCalendarNowAction();
        toast.success(`Sincronizado — ${result.imported} evento(s) importado(s).`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo sincronizar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-[17px] font-semibold text-foreground">Integraciones</h2>
        <p className="text-sm text-neutral-500">
          Cada workspace conecta sus propias credenciales — no se comparten entre clientes.
        </p>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-success-bg text-success-strong">
              <MessageCircle className="size-4" aria-hidden="true" />
            </span>
            <h3 className="text-[15px] font-medium text-foreground">WhatsApp (YCloud)</h3>
          </div>
          <Badge variant={isActive ? "success" : "neutral"}>{isActive ? "Conectado" : "No conectado"}</Badge>
        </div>

        {whatsapp ? (
          <div className="flex flex-col gap-1 text-sm text-neutral-600">
            {whatsapp.displayName && <p className="font-medium text-foreground">{whatsapp.displayName}</p>}
            <p>Número: {whatsapp.externalAccountId}</p>
            <p>API Key: {whatsapp.hasCredentials ? "configurada ✓" : "sin configurar"}</p>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">Todavía no conectaste una cuenta de WhatsApp Business.</p>
        )}

        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="secondary" disabled={!canManage} onClick={() => setSheetOpen(true)}>
            {whatsapp ? "Editar" : "Conectar"}
          </Button>
          {isActive && (
            <Button size="sm" variant="destructive" disabled={!canManage || isPending} onClick={handleDisconnect}>
              Desconectar
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary-100 text-primary-700">
              <CalendarDays className="size-4" aria-hidden="true" />
            </span>
            <h3 className="text-[15px] font-medium text-foreground">Google Calendar</h3>
          </div>
          <Badge variant={googleCalendar.connected ? "success" : "neutral"}>
            {googleCalendar.connected ? "Conectado" : "No conectado"}
          </Badge>
        </div>

        {googleCalendar.connected ? (
          <p className="text-sm text-neutral-600">Cuenta: {googleCalendar.email}</p>
        ) : (
          <p className="text-sm text-neutral-500">
            Importa tus eventos de Google Calendar y envía los eventos que crees en el CRM.
          </p>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {googleCalendar.connected ? (
            <>
              <Button size="sm" variant="secondary" onClick={handleSyncGoogle} loading={isSyncing}>
                <RefreshCw size={14} aria-hidden="true" />
                Sincronizar ahora
              </Button>
              <Button size="sm" variant="destructive" disabled={!canManage || isPending} onClick={handleDisconnectGoogle}>
                Desconectar
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={!canManage} onClick={() => (window.location.href = "/api/integrations/google-calendar/connect")}>
              Conectar Google Calendar
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-success-bg text-success-strong">
              <Table2 className="size-4" aria-hidden="true" />
            </span>
            <h3 className="text-[15px] font-medium text-foreground">Google Sheets (KPIs)</h3>
          </div>
          <Badge variant={googleSheets.connected ? "success" : "neutral"}>
            {googleSheets.connected ? "🟢 Conectado" : "No conectado"}
          </Badge>
        </div>

        {googleSheets.connected ? (
          <p className="text-sm text-neutral-600">Cuenta de Google: {googleSheets.email}</p>
        ) : (
          <p className="text-sm text-neutral-500">
            Conectá una cuenta de Google para ver los KPIs de tus setters directamente en el CRM — cada setter comparte su
            propia hoja (permiso de lectura) con esta cuenta, no hace falta que cada uno haga su propio login.
          </p>
        )}

        {!googleSheets.connected && (
          <Button size="sm" disabled={!canManage} className="mt-4" onClick={() => (window.location.href = "/api/integrations/google-sheets/connect")}>
            Conectar Google Sheets
          </Button>
        )}

        <KpiSettersManager canManage={canManage} accountConnected={googleSheets.connected} />
      </Card>

      <Card>
        <div className="mb-1 flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-medium text-foreground">Calendly</h3>
          <Badge variant="neutral">No conectado</Badge>
        </div>
        <p className="text-sm text-neutral-500">
          Próximamente — requiere un token de acceso de tu cuenta de Calendly.
        </p>
        <Button size="sm" variant="secondary" disabled className="mt-4">
          Conectar Calendly
        </Button>
      </Card>

      <Card>
        <div className="mb-1 flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-medium text-foreground">Google Drive</h3>
          <Badge variant="neutral">No conectado</Badge>
        </div>
        <p className="text-sm text-neutral-500">
          Próximamente — importá documentos de Drive/Docs/Sheets y exportá datos del CRM directamente ahí.
        </p>
        <Button size="sm" variant="secondary" disabled className="mt-4">
          Conectar Google Drive
        </Button>
      </Card>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-accent-100 text-accent-700">
              <Bot className="size-4" aria-hidden="true" />
            </span>
            <h3 className="text-[15px] font-medium text-foreground">OpenRouter (Motor de IA)</h3>
          </div>
          <Badge variant={isOpenRouterActive ? "success" : "neutral"}>{isOpenRouterActive ? "Conectado" : "No conectado"}</Badge>
        </div>

        {openRouter ? (
          <div className="flex flex-col gap-1 text-sm text-neutral-600">
            {openRouter.displayName && <p className="font-medium text-foreground">{openRouter.displayName}</p>}
            <p>API Key: {openRouter.hasCredentials ? "configurada ✓" : "sin configurar"}</p>
          </div>
        ) : (
          <p className="text-sm text-neutral-500">
            Conectá tu cuenta de OpenRouter para que el motor de IA pueda responder conversaciones de WhatsApp.
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <Button size="sm" variant="secondary" disabled={!canManage} onClick={() => setOpenRouterSheetOpen(true)}>
            {openRouter ? "Editar" : "Conectar"}
          </Button>
          {isOpenRouterActive && (
            <Button size="sm" variant="destructive" disabled={!canManage || isPending} onClick={handleDisconnectOpenRouter}>
              Desconectar
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="mb-1 text-[15px] font-medium text-foreground">Otros proveedores</h3>
        <p className="text-sm text-neutral-500">HighLevel — próximamente.</p>
      </Card>

      {sheetOpen && (
        <WhatsAppIntegrationSheet
          onClose={() => setSheetOpen(false)}
          current={whatsapp}
          onSaved={() => {
            setSheetOpen(false);
            refetch();
          }}
        />
      )}

      {openRouterSheetOpen && (
        <OpenRouterIntegrationSheet
          onClose={() => setOpenRouterSheetOpen(false)}
          current={openRouter}
          onSaved={() => {
            setOpenRouterSheetOpen(false);
            refetchOpenRouter();
          }}
        />
      )}
    </div>
  );
}
