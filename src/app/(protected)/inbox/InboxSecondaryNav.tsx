"use client";

import { usePathname } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { TabLink, TabsList } from "@/components/ui/Tabs";

interface Section {
  label: string;
  href: string;
  exact?: boolean;
}

const SECTIONS: Section[] = [
  { label: "Conversaciones", href: "/inbox", exact: true },
  { label: "Contactos", href: "/inbox/contactos" },
  { label: "Etiquetas", href: "/inbox/etiquetas" },
  { label: "Plantillas", href: "/inbox/plantillas" },
];

/** Inbox's secondary nav — one unified communication area (Conversaciones +
 * Contactos + Etiquetas + Plantillas) instead of Contactos living as its own
 * separate top-level sidebar item. Breadcrumb label is derived from the same
 * SECTIONS list so it can never drift out of sync with the tab strip. */
export function InboxSecondaryNav() {
  const pathname = usePathname();
  const current = SECTIONS.find((s) => (s.exact ? pathname === s.href : pathname.startsWith(s.href)));

  return (
    <div className="flex flex-col gap-3 border-b border-border-default bg-surface-1 px-4 pt-4 sm:px-6">
      <Breadcrumbs items={[{ label: "Inbox", href: "/inbox" }, { label: current?.label ?? "Conversaciones" }]} />
      <TabsList className="border-b-0">
        {SECTIONS.map((section) => (
          <TabLink key={section.href} href={section.href} exact={section.exact}>
            {section.label}
          </TabLink>
        ))}
      </TabsList>
    </div>
  );
}
