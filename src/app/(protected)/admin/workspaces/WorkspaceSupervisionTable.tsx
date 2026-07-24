import { Eye } from "lucide-react";
import type { PlatformWorkspaceSummary } from "@/lib/platform/queries";
import { enterSupervisorMode } from "@/lib/platform/actions";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

export function WorkspaceSupervisionTable({ workspaces }: { workspaces: PlatformWorkspaceSummary[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="border-b border-border-default text-xs uppercase text-neutral-500">
            <th className="px-4 py-3 font-medium">Workspace</th>
            <th className="px-4 py-3 font-medium">Propietario</th>
            <th className="px-4 py-3 font-medium">Miembros</th>
            <th className="px-4 py-3 font-medium">Creado</th>
            <th className="px-4 py-3 font-medium">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {workspaces.map((w) => (
            <tr key={w.workspaceId} className="border-b border-border-default last:border-b-0 hover:bg-surface-2">
              <td className="px-4 py-3">
                <p className="text-sm font-medium text-foreground">{w.name}</p>
                <p className="text-xs text-neutral-500">{w.slug}</p>
              </td>
              <td className="px-4 py-3">
                <p className="text-sm text-foreground">{w.ownerName}</p>
                <p className="text-xs text-neutral-500">{w.ownerEmail}</p>
              </td>
              <td className="px-4 py-3 font-mono text-xs">{w.memberCount}</td>
              <td className="px-4 py-3 text-xs text-neutral-500">{formatDate(w.createdAt)}</td>
              <td className="px-4 py-3">
                <form action={enterSupervisorMode.bind(null, w.workspaceId)}>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-2"
                  >
                    <Eye size={13} aria-hidden="true" />
                    Ver Dashboard
                  </button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
