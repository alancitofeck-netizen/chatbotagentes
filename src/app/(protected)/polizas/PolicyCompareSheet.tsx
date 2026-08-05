"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { getPolicyListAction, getPolicyByIdAction, getPolicyCoveragesAction } from "@/lib/policies/actions";
import type { PolicyListItem, PolicyDetail, PolicyCoverage } from "@/lib/policies/queries";
import { formatCurrency } from "@/lib/utils/format";

const INSURANCE_TYPE_LABEL: Record<string, string> = { auto: "Auto", hogar: "Hogar", vida: "Vida", otro: "Otro" };

function formatDateOnly(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

export function PolicyCompareSheet({ open, onClose, initialPolicyId }: { open: boolean; onClose: () => void; initialPolicyId: string | null }) {
  const [options, setOptions] = useState<PolicyListItem[]>([]);
  const [leftId, setLeftId] = useState<string | null>(initialPolicyId);
  const [rightId, setRightId] = useState<string | null>(null);
  const [left, setLeft] = useState<{ detail: PolicyDetail; coverages: PolicyCoverage[] } | null>(null);
  const [right, setRight] = useState<{ detail: PolicyDetail; coverages: PolicyCoverage[] } | null>(null);

  useEffect(() => {
    if (!open) return;
    Promise.resolve().then(() => {
      setLeftId(initialPolicyId);
      setRightId(null);
    });
    getPolicyListAction().then(setOptions);
  }, [open, initialPolicyId]);

  useEffect(() => {
    if (!leftId) {
      Promise.resolve().then(() => setLeft(null));
      return;
    }
    Promise.all([getPolicyByIdAction(leftId), getPolicyCoveragesAction(leftId)]).then(([detail, coverages]) => {
      if (detail) setLeft({ detail, coverages });
    });
  }, [leftId]);

  useEffect(() => {
    if (!rightId) {
      Promise.resolve().then(() => setRight(null));
      return;
    }
    Promise.all([getPolicyByIdAction(rightId), getPolicyCoveragesAction(rightId)]).then(([detail, coverages]) => {
      if (detail) setRight({ detail, coverages });
    });
  }, [rightId]);

  function field(detail: PolicyDetail, key: keyof PolicyDetail): string {
    switch (key) {
      case "premium":
        return detail.premium !== null ? formatCurrency(detail.premium, detail.premiumCurrency) : "—";
      case "sumInsured":
        return detail.sumInsured !== null ? formatCurrency(detail.sumInsured, detail.premiumCurrency) : "—";
      case "commissionAmount":
        return detail.commissionAmount !== null ? formatCurrency(detail.commissionAmount, detail.premiumCurrency) : "—";
      case "endDate":
        return formatDateOnly(detail.endDate);
      case "startDate":
        return formatDateOnly(detail.startDate);
      case "insuranceType":
        return INSURANCE_TYPE_LABEL[detail.insuranceType] ?? detail.insuranceType;
      default:
        return (detail[key] as string | null) ?? "—";
    }
  }

  const FIELDS: { label: string; key: keyof PolicyDetail }[] = [
    { label: "Aseguradora", key: "company" },
    { label: "Producto", key: "product" },
    { label: "Tipo", key: "insuranceType" },
    { label: "Prima", key: "premium" },
    { label: "Suma asegurada", key: "sumInsured" },
    { label: "Franquicia", key: "deductible" },
    { label: "Inicio", key: "startDate" },
    { label: "Vencimiento", key: "endDate" },
    { label: "Comisión", key: "commissionAmount" },
  ];

  return (
    <Sheet open={open} onClose={onClose} title="Comparar pólizas" className="max-w-2xl">
      <div className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <Select label="Póliza A" value={leftId ?? ""} onChange={(e) => setLeftId(e.target.value || null)}>
            <option value="">Elegir…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.contactName} — {o.company}
              </option>
            ))}
          </Select>
          <Select label="Póliza B" value={rightId ?? ""} onChange={(e) => setRightId(e.target.value || null)}>
            <option value="">Elegir…</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.contactName} — {o.company}
              </option>
            ))}
          </Select>
        </div>

        {!left || !right ? (
          <p className="py-8 text-center text-sm text-neutral-500">Elegí dos pólizas para comparar.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-default">
            <table className="w-full text-left text-sm">
              <tbody>
                {FIELDS.map((f) => {
                  const a = field(left.detail, f.key);
                  const b = field(right.detail, f.key);
                  const differs = a !== b;
                  return (
                    <tr key={f.label} className={`border-b border-border-default last:border-0 ${differs ? "bg-warning-bg/40" : ""}`}>
                      <td className="whitespace-nowrap px-3 py-2 text-xs font-medium uppercase tracking-wide text-neutral-400">{f.label}</td>
                      <td className="px-3 py-2 text-foreground">{a}</td>
                      <td className="px-3 py-2 text-foreground">{b}</td>
                    </tr>
                  );
                })}
                <tr className="border-t border-border-default">
                  <td className="whitespace-nowrap px-3 py-2 align-top text-xs font-medium uppercase tracking-wide text-neutral-400">Coberturas</td>
                  <td className="px-3 py-2 align-top">
                    {left.coverages.length === 0 ? (
                      <span className="text-neutral-500">—</span>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {left.coverages.map((c) => (
                          <li key={c.id}>{c.name}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-2 align-top">
                    {right.coverages.length === 0 ? (
                      <span className="text-neutral-500">—</span>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {right.coverages.map((c) => (
                          <li key={c.id}>{c.name}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {(leftId && !left) || (rightId && !right) ? <Skeleton className="h-32 w-full" /> : null}
      </div>
    </Sheet>
  );
}
