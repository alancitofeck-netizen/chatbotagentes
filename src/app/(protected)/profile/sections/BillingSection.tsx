"use client";

import { CreditCard } from "lucide-react";
import { Card } from "@/components/ui/Card";

/** Pure placeholder — no billing/plan system exists yet, requested "dejar
 * preparado" (structure only, explicitly not implemented). */
export function BillingSection() {
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-surface-3 text-neutral-400">
          <CreditCard className="size-6" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">Facturación</p>
          <p className="text-[13px] text-neutral-500">Próximamente — planes y método de pago.</p>
        </div>
      </div>
    </Card>
  );
}
