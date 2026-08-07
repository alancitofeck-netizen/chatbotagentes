"use client";

import { Card } from "@/components/ui/Card";
import { Users, ShieldCheck, FileCheck2, Wallet, CalendarDays } from "lucide-react";

const CHIP_CLASS = "rounded-full border border-border-default px-3 py-1 text-xs font-medium text-foreground transition-colors hover:border-accent-500 hover:bg-surface-2";

function ExportCard({ icon: Icon, title, links }: { icon: typeof Users; title: string; links: { label: string; href: string }[] }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border-default bg-surface-1 p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <Icon className="size-[18px]" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-foreground">{title}</p>
      </div>
      <div className="flex flex-wrap justify-end gap-1.5">
        {links.map((l) => (
          <a key={l.label} href={l.href} className={CHIP_CLASS} onClick={() => setTimeout(() => window.dispatchEvent(new Event("data-transfer:export")), 300)}>
            {l.label}
          </a>
        ))}
      </div>
    </div>
  );
}

export function ExportCenter() {
  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-foreground">📤 Exportar</p>
        <p className="text-[13px] text-neutral-500">Llevate tus datos cuando quieras, en el formato que necesites</p>
      </div>

      <div className="flex flex-col gap-2">
        <ExportCard
          icon={Users}
          title="Exportar Clientes"
          links={[
            { label: "CSV", href: "/api/documents/export?entity=contacts&format=csv" },
            { label: "Excel", href: "/api/documents/export?entity=contacts&format=xlsx" },
          ]}
        />
        <ExportCard
          icon={ShieldCheck}
          title="Exportar Prospectos"
          links={[
            { label: "CSV", href: "/api/documents/export?entity=prospects&format=csv" },
            { label: "Excel", href: "/api/documents/export?entity=prospects&format=xlsx" },
          ]}
        />
        <ExportCard
          icon={FileCheck2}
          title="Exportar Pólizas"
          links={[
            { label: "CSV", href: "/api/policies/export?format=csv" },
            { label: "Excel", href: "/api/policies/export?format=xlsx" },
            { label: "PDF", href: "/api/policies/export?format=pdf" },
          ]}
        />
        <ExportCard
          icon={Wallet}
          title="Exportar Cobros"
          links={[
            { label: "CSV", href: "/api/documents/export?entity=payments&format=csv" },
            { label: "Excel", href: "/api/documents/export?entity=payments&format=xlsx" },
          ]}
        />
        <ExportCard
          icon={CalendarDays}
          title="Exportar Agenda"
          links={[
            { label: "ICS", href: "/api/calendar/export-ics" },
            { label: "CSV", href: "/api/documents/export?entity=calendar&format=csv" },
          ]}
        />
      </div>
    </Card>
  );
}
