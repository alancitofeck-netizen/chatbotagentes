"use client";

import { usePathname } from "next/navigation";
import { TabLink, TabsList } from "@/components/ui/Tabs";

interface Section {
  label: string;
  href: string;
  exact?: boolean;
}

const SECTIONS: Section[] = [
  { label: "Tablero", href: "/advisors", exact: true },
  { label: "Posibles Pólizas", href: "/advisors/posibles-polizas" },
];

/** Asesores' secondary nav — Posibles Pólizas lives here as a section of
 * Asesores instead of its own top-level sidebar item (moved on explicit
 * request), same "one unified area" pattern InboxSecondaryNav.tsx already
 * uses for Contactos/Etiquetas/Plantillas under Inbox. `insurance_prospects`
 * keeps its own workspace_modules activation — only the nav entry and route
 * moved, not the module boundary (same posture as ATS staying its own
 * module after its nav entry moved into CRM's tab strip). */
export function AdvisorsSecondaryNav() {
  const pathname = usePathname();
  const isImportRoute = pathname.startsWith("/advisors/import");
  if (isImportRoute) return null;

  return (
    <div className="px-4 pt-4 sm:px-6 lg:px-8">
      <TabsList>
        {SECTIONS.map((section) => (
          <TabLink key={section.href} href={section.href} exact={section.exact}>
            {section.label}
          </TabLink>
        ))}
      </TabsList>
    </div>
  );
}
