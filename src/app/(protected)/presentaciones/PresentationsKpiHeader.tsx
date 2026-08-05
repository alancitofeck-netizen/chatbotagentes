import { Sparkles, FileText, Share2, Clock, Timer, Eye } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { PresentationsKpis } from "@/lib/presentations/queries";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function KpiTile({ icon, iconBg, iconColor, value, label, sublabel }: { icon: React.ReactNode; iconBg: string; iconColor: string; value: string; label: string; sublabel?: string }) {
  return (
    <Card className="flex flex-col gap-3">
      <span className={`flex size-10 items-center justify-center rounded-full ${iconBg} ${iconColor}`}>{icon}</span>
      <div>
        <p className="font-mono text-2xl font-semibold leading-none text-foreground">{value}</p>
        <p className="mt-1.5 text-[13px] text-neutral-500">{label}</p>
        {sublabel && <p className="text-xs text-neutral-400">{sublabel}</p>}
      </div>
    </Card>
  );
}

export function PresentationsKpiHeader({ kpis }: { kpis: PresentationsKpis }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <KpiTile
        icon={<Sparkles className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-accent-100"
        iconColor="text-accent-700"
        value={String(kpis.totalCreated)}
        label="Presentaciones creadas"
      />
      <KpiTile
        icon={<FileText className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-info-bg"
        iconColor="text-info-strong"
        value={kpis.lastCreatedTitle ?? "—"}
        label="Última presentación"
        sublabel={formatDate(kpis.lastCreatedAt)}
      />
      <KpiTile
        icon={<Share2 className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-success-bg"
        iconColor="text-success-strong"
        value={String(kpis.sharedCount)}
        label="Presentaciones compartidas"
      />
      <KpiTile
        icon={<Clock className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-warning-bg"
        iconColor="text-warning-strong"
        value={formatDate(kpis.lastEditedAt)}
        label="Última fecha de edición"
      />
      <KpiTile
        icon={<Timer className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-primary-100"
        iconColor="text-primary-700"
        value={kpis.avgCreationMinutes !== null ? `${kpis.avgCreationMinutes} min` : "—"}
        label="Tiempo promedio de creación"
      />
      <KpiTile
        icon={<Eye className="size-[18px]" aria-hidden="true" />}
        iconBg="bg-accent-100"
        iconColor="text-accent-700"
        value={kpis.mostViewed ? String(kpis.mostViewed.viewsCount) : "—"}
        label="Presentación con más visualizaciones"
        sublabel={kpis.mostViewed?.title}
      />
    </div>
  );
}
