import { Trophy } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { TopOpportunity } from "@/lib/dashboard/queries";

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("es", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export function TopDeals({ deals }: { deals: TopOpportunity[] }) {
  return (
    <Card>
      <CardHeader title="Top deals" />
      {deals.length === 0 ? (
        <EmptyState icon={Trophy} title="Sin oportunidades todavía" />
      ) : (
        <ul className="flex flex-col gap-1">
          {deals.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 rounded-md px-2 py-2 hover:bg-surface-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{d.title}</p>
                <p className="truncate text-[13px] text-neutral-500">{d.contactName}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-mono text-sm font-medium text-foreground">
                  {formatCurrency(d.value, d.currency)}
                </span>
                {d.stageName && <Badge variant="accent">{d.stageName}</Badge>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
