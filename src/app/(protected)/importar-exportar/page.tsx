import { requireActiveWorkspace } from "@/lib/auth/session";
import { assertModuleEnabled } from "@/lib/settings/queries";
import { getDataTransferHistory } from "@/lib/dataTransfer/queries";
import { getBackups } from "@/lib/dataTransfer/backups";
import { getGoogleSheetsAccountStatus } from "@/lib/integrations/googleSheets";
import { getGoogleDriveStatus } from "@/lib/integrations/googleDrive";
import { ImportExportShell } from "./ImportExportShell";

export default async function ImportarExportarPage() {
  const { workspaceId } = await requireActiveWorkspace();
  await assertModuleEnabled(workspaceId, "data_transfer");

  const [history, backups, googleSheets, googleDrive] = await Promise.all([
    getDataTransferHistory(workspaceId),
    getBackups(workspaceId),
    getGoogleSheetsAccountStatus(workspaceId),
    getGoogleDriveStatus(workspaceId),
  ]);

  return (
    <div className="flex flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">Tus datos, tuyos</p>
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">Importar / Exportar</h1>
        <p className="text-sm text-neutral-500">Trae tu cartera en minutos — llévatela cuando quieras</p>
      </div>
      <ImportExportShell initialHistory={history} initialBackups={backups} initialSync={{ googleSheets, googleDrive }} />
    </div>
  );
}
