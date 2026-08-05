"use client";

import { DISCOVERY_FIELDS } from "@/lib/advisorySessions/constants";
import { DynamicQuestionForm } from "../DynamicQuestionForm";

export function DiscoveryStep({ data, onChange }: { data: Record<string, unknown>; onChange: (next: Record<string, unknown>) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold text-foreground">Descubrimiento</h2>
      <p className="mb-4 text-sm text-neutral-500">Entendé qué necesita realmente tu cliente antes de ofrecerle nada.</p>
      <DynamicQuestionForm fields={DISCOVERY_FIELDS} data={data} onChange={onChange} columns={1} />
    </div>
  );
}
