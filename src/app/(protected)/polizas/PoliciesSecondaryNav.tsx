"use client";

import { TabLink, TabsList } from "@/components/ui/Tabs";

interface Section {
  label: string;
  href: string;
  exact?: boolean;
}

const SECTIONS: Section[] = [
  { label: "Cartera", href: "/polizas", exact: true },
  { label: "Posibles Pólizas", href: "/polizas/posibles-polizas" },
];

/** Pólizas' secondary nav — Posibles Pólizas se mueve acá desde Asesores
 * (pedido explícito), mismo patrón que AdvisorsSecondaryNav.tsx tenía antes
 * de perder esta sección. `insurance_prospects` mantiene su propia
 * activación de workspace_modules — solo se movieron el nav entry y la
 * ruta, no el límite del módulo (misma postura que cuando "Pólizas" en sí
 * se movió de Asesores a su propio módulo top-level). */
export function PoliciesSecondaryNav() {
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
