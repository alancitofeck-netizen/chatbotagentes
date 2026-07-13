"use client";

import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CompanyGroup } from "@/lib/contacts/queries";

export function CompanyList({
  companies,
  onSelectCompany,
}: {
  companies: CompanyGroup[];
  onSelectCompany: (company: string) => void;
}) {
  if (companies.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Building2}
          title="Sin empresas"
          description="Ningún contacto tiene una empresa asignada todavía."
        />
      </div>
    );
  }

  return (
    <ul className="flex flex-col">
      {companies.map((c) => (
        <li key={c.company}>
          <button
            type="button"
            onClick={() => onSelectCompany(c.company)}
            className="flex w-full items-center justify-between gap-3 border-b border-border-default px-6 py-3 text-left transition-colors hover:bg-surface-2"
          >
            <div className="flex items-center gap-3">
              <Building2 size={18} className="text-neutral-400" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">{c.company}</span>
            </div>
            <Badge variant="neutral">
              {c.contactCount} contacto{c.contactCount === 1 ? "" : "s"}
            </Badge>
          </button>
        </li>
      ))}
    </ul>
  );
}
