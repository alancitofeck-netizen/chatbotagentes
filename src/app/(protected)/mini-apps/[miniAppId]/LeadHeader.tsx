import type { MiniAppLeadStatus } from "@/lib/miniApps/queries";
import { StatusBadge } from "@/components/responseSummary/StatusBadge";
import { LEAD_STATUS_LABEL, LEAD_STATUS_VARIANT } from "./leadStatus";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function LeadHeader({ nombre, status, origenApp }: { nombre: string; status: MiniAppLeadStatus; origenApp: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-accent-400 to-primary-600 text-lg font-semibold text-white">
        {initials(nombre)}
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <div className="flex items-center gap-2">
          <p className="text-lg font-semibold text-white">{nombre}</p>
          <StatusBadge variant={LEAD_STATUS_VARIANT[status]}>{LEAD_STATUS_LABEL[status]}</StatusBadge>
        </div>
        <p className="text-xs text-white/50">{origenApp}</p>
      </div>
    </div>
  );
}
