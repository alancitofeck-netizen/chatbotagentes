"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Copy, MessageCircle, Eye, ArrowUpRight, AlertTriangle, Users, UserCheck, PhoneCall, Handshake } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/toast/toast";
import type { ReferralRow, ReferralStatus } from "@/lib/asesorias/referrals";
import { REFERRAL_STATUS_LABEL, REFERRAL_STATUS_VARIANT } from "./referralStatus";
import { ReferralDetailSheet } from "./ReferralDetailSheet";

type DateRangeFilter = "all" | "7" | "30";
const DATE_RANGE_LABEL: Record<DateRangeFilter, string> = { all: "Todo el tiempo", "7": "Últimos 7 días", "30": "Últimos 30 días" };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function whatsAppHref(phone: string, name: string): string {
  const digits = phone.replace(/\D/g, "");
  const message = `Hola ${name}, te escribo porque fuiste referido en una asesoría con nosotros.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function KpiTile({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <Card className="flex flex-col gap-2">
      <span className="flex size-9 items-center justify-center rounded-full bg-accent-100 text-accent-700">{icon}</span>
      <p className="font-mono text-2xl font-semibold leading-none text-foreground">{value}</p>
      <p className="text-[13px] text-neutral-500">{label}</p>
    </Card>
  );
}

export function ReferidosShell({ initialReferrals }: { initialReferrals: ReferralRow[] }) {
  const [referrals, setReferrals] = useState(initialReferrals);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ReferralStatus | "all">("all");
  const [advisorFilter, setAdvisorFilter] = useState<string>("all");
  const [asesoriaFilter, setAsesoriaFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<DateRangeFilter>("all");
  const [now] = useState(() => Date.now());
  const [selected, setSelected] = useState<ReferralRow | null>(null);

  const advisors = useMemo(() => [...new Set(referrals.map((r) => r.advisorName).filter((n): n is string => Boolean(n)))].sort(), [referrals]);
  const asesorias = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of referrals) map.set(r.asesoriaId, r.asesoriaName);
    return [...map.entries()];
  }, [referrals]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return referrals.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (advisorFilter !== "all" && r.advisorName !== advisorFilter) return false;
      if (asesoriaFilter !== "all" && r.asesoriaId !== asesoriaFilter) return false;
      if (dateRange !== "all") {
        const cutoff = now - Number(dateRange) * 24 * 60 * 60 * 1000;
        if (new Date(r.createdAt).getTime() < cutoff) return false;
      }
      if (q && !r.name.toLowerCase().includes(q) && !r.phone.includes(q)) return false;
      return true;
    });
  }, [referrals, search, statusFilter, advisorFilter, asesoriaFilter, dateRange, now]);

  const groups = useMemo(() => {
    const map = new Map<string, ReferralRow[]>();
    for (const r of filtered) {
      const list = map.get(r.asesoriaId) ?? [];
      list.push(r);
      map.set(r.asesoriaId, list);
    }
    return [...map.entries()];
  }, [filtered]);

  const total = referrals.length;
  const nuevos = referrals.filter((r) => r.status === "nuevo").length;
  const contactados = referrals.filter((r) => r.status === "contactado").length;
  const convertidos = referrals.filter((r) => r.status === "convertido").length;

  function handleCopy(phone: string) {
    navigator.clipboard.writeText(`+${phone}`);
    toast.success("Número copiado.");
  }

  function handleStatusUpdated(referralId: string, status: ReferralStatus) {
    setReferrals((prev) => prev.map((r) => (r.id === referralId ? { ...r, status } : r)));
    setSelected((prev) => (prev && prev.id === referralId ? { ...prev, status } : prev));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile icon={<Users className="size-[18px]" aria-hidden="true" />} value={total} label="Total referidos" />
        <KpiTile icon={<UserCheck className="size-[18px]" aria-hidden="true" />} value={nuevos} label="Referidos nuevos" />
        <KpiTile icon={<PhoneCall className="size-[18px]" aria-hidden="true" />} value={contactados} label="Contactados" />
        <KpiTile icon={<Handshake className="size-[18px]" aria-hidden="true" />} value={convertidos} label="Convertidos" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o teléfono…"
            className="w-full rounded-full border border-border-default bg-surface-1 py-2 pr-3 pl-9 text-sm text-foreground outline-none focus:border-accent-500"
          />
        </div>
        <select value={asesoriaFilter} onChange={(e) => setAsesoriaFilter(e.target.value)} className="rounded-full border border-border-default bg-surface-1 px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-accent-500">
          <option value="all">Todas las asesorías</option>
          {asesorias.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ReferralStatus | "all")} className="rounded-full border border-border-default bg-surface-1 px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-accent-500">
          <option value="all">Todos los estados</option>
          {(Object.keys(REFERRAL_STATUS_LABEL) as ReferralStatus[]).map((s) => (
            <option key={s} value={s}>
              {REFERRAL_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        {advisors.length > 1 && (
          <select value={advisorFilter} onChange={(e) => setAdvisorFilter(e.target.value)} className="rounded-full border border-border-default bg-surface-1 px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-accent-500">
            <option value="all">Todos los asesores</option>
            {advisors.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
        <select value={dateRange} onChange={(e) => setDateRange(e.target.value as DateRangeFilter)} className="rounded-full border border-border-default bg-surface-1 px-3 py-2 text-xs font-medium text-foreground outline-none focus:border-accent-500">
          {(Object.keys(DATE_RANGE_LABEL) as DateRangeFilter[]).map((key) => (
            <option key={key} value={key}>
              {DATE_RANGE_LABEL[key]}
            </option>
          ))}
        </select>
      </div>

      {total === 0 ? (
        <EmptyState icon={Users} title="Todavía no hay referidos" description="Cuando un prospecto comparta referidos dentro de una asesoría, van a aparecer acá." />
      ) : groups.length === 0 ? (
        <EmptyState icon={Users} title="Ningún referido con estos filtros" description="Probá cambiar la búsqueda o los filtros." />
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map(([asesoriaId, rows]) => (
            <div key={asesoriaId}>
              <div className="mb-2.5 flex items-baseline justify-between gap-2">
                <h3 className="text-[13px] font-semibold tracking-wide text-neutral-500 uppercase">Referidos de {rows[0].asesoriaName}</h3>
                <span className="text-xs text-neutral-400">
                  Presentación — Cita Inicial · {rows.length} {rows.length === 1 ? "referido" : "referidos"}
                </span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border-default text-xs text-neutral-500">
                      <th className="px-3 py-2.5 font-medium">Nombre</th>
                      <th className="px-3 py-2.5 font-medium">Teléfono</th>
                      <th className="px-3 py-2.5 font-medium">Asesor</th>
                      <th className="px-3 py-2.5 font-medium">Fecha</th>
                      <th className="px-3 py-2.5 font-medium">Estado</th>
                      <th className="px-3 py-2.5 font-medium">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-border-default last:border-0 hover:bg-surface-2">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <button type="button" onClick={() => setSelected(r)} className="text-left font-medium text-foreground hover:text-accent-700">
                              {r.name}
                            </button>
                            {r.isDuplicate && (
                              <span title="Este teléfono ya fue referido en otra asesoría" className="text-warning-strong">
                                <AlertTriangle className="size-3.5" aria-hidden="true" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-neutral-600">+{r.phone}</td>
                        <td className="px-3 py-2.5 text-neutral-600">{r.advisorName ?? "—"}</td>
                        <td className="px-3 py-2.5 text-neutral-600">{formatDate(r.createdAt)}</td>
                        <td className="px-3 py-2.5">
                          <Badge variant={REFERRAL_STATUS_VARIANT[r.status]}>{REFERRAL_STATUS_LABEL[r.status]}</Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelected(r)}
                              className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-surface-3 hover:text-foreground"
                              aria-label="Ver"
                              title="Ver"
                            >
                              <Eye size={14} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopy(r.phone)}
                              className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-surface-3 hover:text-foreground"
                              aria-label="Copiar número"
                              title="Copiar número"
                            >
                              <Copy size={14} aria-hidden="true" />
                            </button>
                            <a
                              href={whatsAppHref(r.phone, r.name)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-surface-3 hover:text-success-strong"
                              aria-label="Abrir WhatsApp"
                              title="Abrir WhatsApp"
                            >
                              <MessageCircle size={14} aria-hidden="true" />
                            </a>
                            <Link
                              href={`/asesorias/${r.asesoriaId}/resumen`}
                              className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-surface-3 hover:text-foreground"
                              aria-label="Ver asesoría"
                              title="Ver asesoría"
                            >
                              <ArrowUpRight size={14} aria-hidden="true" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && <ReferralDetailSheet referral={selected} onClose={() => setSelected(null)} onStatusUpdated={handleStatusUpdated} />}
    </div>
  );
}
