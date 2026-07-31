import { Card } from "@/components/ui/Card";
import type { MiniAppLeadRow, MiniAppTemplateKey } from "@/lib/miniApps/queries";
import { SDK_VERSION } from "@/lib/miniApps/linkedAppOptions";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</span>
      <span className="text-2xl font-semibold text-foreground">{value}</span>
    </Card>
  );
}

/** "Total de visitas"/"Conversión" now come from real mini_app_visits rows
 * — only possible now that Mini Apps hosts its own public pages (Phase 2);
 * a mini app that still points at an externally-hosted `external_url`
 * simply never accumulates visits, so both cards degrade to "0"/"—"
 * gracefully rather than erroring. */
export function DashboardTab({
  leads,
  visitsCount,
  templateKey,
}: {
  leads: MiniAppLeadRow[];
  visitsCount: number;
  templateKey: MiniAppTemplateKey;
}) {
  const converted = leads.filter((l) => l.status === "converted").length;
  const lastLead = leads[0];
  const conversionPct = visitsCount > 0 ? Math.round((leads.length / visitsCount) * 1000) / 10 : null;

  return (
    <div className="flex flex-col gap-4">
      {templateKey === "app_vinculada" && (
        <Card className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Estado de conexión</span>
            <span className={`text-sm font-medium ${leads.length > 0 ? "text-success-strong" : "text-error-strong"}`}>
              {leads.length > 0 ? "🟢 Conectada" : "🔴 Sin conectar"}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Última sincronización</p>
              <p className="text-sm text-foreground">
                {lastLead ? new Date(lastLead.fecha).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Total de leads</p>
              <p className="text-sm text-foreground">{leads.length}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Estado de la API</p>
              <p className="text-sm text-foreground">Operativa</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Versión del SDK</p>
              <p className="text-sm text-foreground">{SDK_VERSION}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total de visitas" value={String(visitsCount)} />
        <StatCard label="Total de leads" value={String(leads.length)} />
        <StatCard label="Conversión" value={conversionPct !== null ? `${conversionPct}%` : "—"} />
        <StatCard label="Convertidos" value={String(converted)} />
        <StatCard
          label="Último lead"
          value={lastLead ? new Date(lastLead.fecha).toLocaleDateString("es", { day: "2-digit", month: "short" }) : "—"}
        />
      </div>
    </div>
  );
}
