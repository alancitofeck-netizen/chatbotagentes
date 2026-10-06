import { PageHeader } from "@/components/ui/PageHeader";
import { FileSpreadsheet } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { isModuleEnabled } from "@/lib/settings/queries";
import { ModuleDisabledState } from "@/components/layout/ModuleDisabledState";
import { getDataTransferHistory } from "@/lib/dataTransfer/queries";
import { getBackups } from "@/lib/dataTransfer/backups";
import { getGoogleSheetsAccountStatus } from "@/lib/integrations/googleSheets";
import { getGoogleDriveStatus } from "@/lib/integrations/googleDrive";
import { ImportExportShell } from "./ImportExportShell";
import { ModuleHelp } from "@/components/onboarding/ModuleHelp";

export default async function ImportarExportarPage() {
  const { workspaceId } = await requireActiveWorkspace();
  if (!(await isModuleEnabled(workspaceId, "data_transfer"))) return <ModuleDisabledState moduleName="Importar y exportar" />;

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
        <PageHeader icon={FileSpreadsheet} title="Importar / Exportar" description="Trae tu cartera en minutos — llévatela cuando quieras" titleAdornment={<ModuleHelp description="Desde acá podés importar información a Growth Link (CSV/Excel) o exportar tus datos cuando quieras." tourKey="data-transfer-intro" />} />
      </div>
      <ImportExportShell initialHistory={history} initialBackups={backups} initialSync={{ googleSheets, googleDrive }} />
    </div>
  );
}
