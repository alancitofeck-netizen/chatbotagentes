import { Card, CardHeader } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { EficaciaVentas } from "@/lib/dashboard/homeQueries";

const RAMO_LABEL: Record<string, string> = { auto: "Auto", hogar: "Hogar", vida: "Vida", otro: "Otro" };
const RAMO_BADGE_CLASS: Record<string, string> = {
  auto: "bg-warning-bg text-warning-strong",
  hogar: "bg-info-bg text-info-strong",
  vida: "bg-success-bg text-success-strong",
  otro: "bg-surface-3 text-neutral-500",
};

export function SalesEfficacyPanel({ eficacia }: { eficacia: EficaciaVentas }) {
  return (
    <Card className="flex flex-col gap-4">
      <CardHeader title="Eficacia de ventas" />
      <p className="-mt-3 text-xs text-neutral-500">Del lead al cierre</p>

      <div className="flex items-center justify-between">
        <span className="text-sm text-neutral-500">Tiempo promedio de cierre</span>
        <span className="text-sm font-semibold text-foreground">
          {eficacia.avgCloseDays === null ? "Todavía sin datos suficientes" : `${eficacia.avgCloseDays} día${eficacia.avgCloseDays === 1 ? "" : "s"}`}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-neutral-500">Conversión lead→cliente</span>
          <span className="text-sm font-semibold text-foreground">{eficacia.conversionRatePct}%</span>
        </div>
        <ProgressBar value={eficacia.conversionRatePct} variant="success" />
      </div>

      {eficacia.porRamo.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-neutral-500">{eficacia.porRamo.map((r) => RAMO_LABEL[r.insuranceType] ?? r.insuranceType).join(" · ")}</span>
            <span className="text-xs text-neutral-400">por ramo</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {eficacia.porRamo.map((r) => (
              <span key={r.insuranceType} className={`rounded-full px-2.5 py-1 text-xs font-medium ${RAMO_BADGE_CLASS[r.insuranceType] ?? RAMO_BADGE_CLASS.otro}`}>
                {RAMO_LABEL[r.insuranceType] ?? r.insuranceType} {r.pct}%
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
