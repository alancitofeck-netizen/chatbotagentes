import { Card } from "@/components/ui/Card";
import type { MiniAppLeadRow } from "@/lib/miniApps/queries";

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</span>
      <span className="text-2xl font-semibold text-foreground">{value}</span>
    </Card>
  );
}

/** Only leads-based totals for now — "visitas" and "conversión" need actual
 * page-view tracking, which only exists once Mini Apps hosts its own public
 * pages (Phase 2); this mini app's page still lives on a 3rd-party domain. */
export function DashboardTab({ leads }: { leads: MiniAppLeadRow[] }) {
  const converted = leads.filter((l) => l.status === "converted").length;
  const lastLead = leads[0];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard label="Total de leads" value={String(leads.length)} />
      <StatCard label="Convertidos" value={String(converted)} />
      <StatCard
        label="Último lead"
        value={lastLead ? new Date(lastLead.fecha).toLocaleDateString("es", { day: "2-digit", month: "short" }) : "—"}
      />
    </div>
  );
}
