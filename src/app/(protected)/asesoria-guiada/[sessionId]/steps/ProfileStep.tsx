"use client";

import { PROFILE_FIELDS } from "@/lib/advisorySessions/constants";
import { DynamicQuestionForm } from "../DynamicQuestionForm";

export function ProfileStep({ data, onChange }: { data: Record<string, unknown>; onChange: (next: Record<string, unknown>) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <h2 className="text-lg font-semibold text-foreground">Perfil del cliente</h2>
      <p className="mb-4 text-sm text-neutral-500">Datos básicos para conocer a tu cliente.</p>
      <DynamicQuestionForm fields={PROFILE_FIELDS} data={data} onChange={onChange} />
    </div>
  );
}
