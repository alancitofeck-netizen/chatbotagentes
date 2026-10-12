import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { ModuleDisabledState } from "@/components/layout/ModuleDisabledState";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getWorkspaceModuleStatus } from "@/lib/settings/queries";
import { getManychatSheetLink } from "@/lib/manychat/sheetLink";
import { fetchSheetRows, SheetError } from "@/lib/manychat/sheetSource";
import { normalizeRows, type NormalizedSheet } from "@/lib/manychat/leads";
import { ManychatBoard } from "./ManychatBoard";
import { Panel } from "./Panel";
import { SheetLinkForm } from "./SheetLinkForm";

export const metadata: Metadata = { title: "ManyChat — Growth Link" };

/** `readAt` es el momento en que se leyó la hoja: el tablero lo usa para decir "Conectado, hace N min". */
async function loadSheet(sheetUrl: string | null): Promise<{ sheet: NormalizedSheet | null; error: string | null; readAt: number }> {
  const readAt = Date.now();
  if (!sheetUrl) return { sheet: null, error: null, readAt };
  try {
    return { sheet: normalizeRows(await fetchSheetRows(sheetUrl)), error: null, readAt };
  } catch (err) {
    return { sheet: null, error: err instanceof SheetError ? err.message : "No se pudo leer la hoja.", readAt };
  }
}

/** Tablero de ManyChat dentro de la app: los datos vienen de la hoja del workspace
 * y se calculan en el servidor. Sin iframe. */
export default async function ManychatPage() {
  const { workspaceId, role, isSupervising } = await requireActiveWorkspace();
  const moduleStatus = await getWorkspaceModuleStatus(workspaceId);
  if (!moduleStatus.some((m) => m.moduleKey === "manychat" && m.enabled)) {
    return <ModuleDisabledState moduleName="ManyChat" />;
  }

  const sheetUrl = await getManychatSheetLink(workspaceId);
  const { sheet, error, readAt } = await loadSheet(sheetUrl);
  // El asesor (agent) administra su propio workspace; el modo supervisor es solo lectura.
  const canEdit = !isSupervising && (role === "owner" || role === "admin" || role === "agent");
  const showBoard = Boolean(sheet && sheet.leads.length > 0);

  // Con datos, el encabezado del tablero hace de título de la página.
  if (showBoard && sheet) {
    return (
      <div className="flex flex-col gap-5 px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <ManychatBoard sheet={sheet} sheetUrl={sheetUrl} canEdit={canEdit} generatedAt={readAt} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 py-4 sm:py-6 lg:py-8">
      <div className="px-4 sm:px-6 lg:px-8">
        <PageHeader
          icon={MessageCircle}
          title="ManyChat"
          description="Leads que llegan desde Instagram y WhatsApp, y en qué etapa están."
          actions={
            <Link href="/manychat/completo" className="text-[13px] font-medium text-accent-700 hover:underline">
              Tablero completo
            </Link>
          }
        />
      </div>

      <div className="flex flex-col gap-5 px-4 sm:px-6 lg:px-8">
        {!sheetUrl && (
          <Panel title="Conectá tu hoja de ManyChat">
            <p className="text-sm text-neutral-600">Pegá el link de la hoja donde ManyChat guarda tus leads. Lo guarda tu workspace, así lo ve todo el equipo.</p>
            {canEdit ? <SheetLinkForm currentUrl={null} /> : <p className="text-sm text-neutral-500">Solo el dueño del workspace puede conectar la hoja.</p>}
          </Panel>
        )}

        {sheetUrl && error && (
          <Panel title="No pudimos leer la hoja">
            <p className="text-sm text-error-strong">{error}</p>
            {canEdit && <SheetLinkForm currentUrl={sheetUrl} />}
          </Panel>
        )}

        {sheet && sheet.leads.length === 0 && (
          <Panel title="Todavía no hay leads">
            <p className="text-sm text-neutral-600">La hoja no tiene filas con fecha válida. Cuando ManyChat cargue leads, aparecen acá.</p>
          </Panel>
        )}

      </div>
    </div>
  );
}
