"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { toast } from "@/components/toast/toast";
import { getAvailableAdvisorWorkspacesAction, createClientAction } from "@/lib/clients/actions";
import type { RealAdvisorWorkspace } from "@/lib/clients/queries";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Wizard de alta — a diferencia de la versión anterior, NO fabrica ningún
 * contacto: solo se puede elegir una cuenta REAL de asesor que todavía no
 * tenga ficha administrativa (getAvailableAdvisorWorkspacesAction, filtra
 * los que ya tienen `clients.linked_workspace_id`). En la práctica esto casi
 * no hace falta usarlo — ensureAdvisorRecordsExist (queries.ts) ya da de
 * alta la ficha automáticamente para cualquier asesor real apenas se abre
 * la lista — pero queda para el caso de un asesor nuevo que se registró
 * recién y todavía no se refrescó la lista. */
export function NewClientWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [available, setAvailable] = useState<RealAdvisorWorkspace[] | null>(null);
  const [picked, setPicked] = useState<RealAdvisorWorkspace | null>(null);
  const [query, setQuery] = useState("");

  const [profession, setProfession] = useState("");
  const [insurer, setInsurer] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");

  const [startDate, setStartDate] = useState(todayIso());
  const [endDate, setEndDate] = useState(addDaysIso(todayIso(), 120));
  const [totalValue, setTotalValue] = useState("");
  const [monthlyValue, setMonthlyValue] = useState("");
  const [commissionModel, setCommissionModel] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAvailableAdvisorWorkspacesAction().then(setAvailable);
  }, []);

  const filtered = (available ?? []).filter((a) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q);
  });

  async function handleSubmit() {
    if (!picked) {
      toast.error("Elegí un asesor real de la lista.");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Completá las fechas del contrato.");
      return;
    }
    setSaving(true);
    try {
      await createClientAction({
        linkedWorkspaceId: picked.workspaceId,
        profession: profession || undefined,
        insurer: insurer || undefined,
        country: country || undefined,
        city: city || undefined,
        contract: {
          startDate,
          endDate,
          totalValue: totalValue ? Number(totalValue) : null,
          monthlyValue: monthlyValue ? Number(monthlyValue) : null,
          commissionModel: commissionModel || null,
        },
      });
      toast.success("Ficha del asesor creada.");
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la ficha del asesor.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Nuevo asesor">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Asesor</label>
          {picked ? (
            <div className="flex items-center justify-between rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <Avatar name={picked.name} src={picked.avatarUrl} size={24} />
                <span className="text-foreground">{picked.name}</span>
                <span className="text-xs text-neutral-500">{picked.email}</span>
              </div>
              <button type="button" onClick={() => setPicked(null)} className="text-xs text-accent-600 hover:underline">
                Cambiar
              </button>
            </div>
          ) : (
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nombre o email…"
                className="w-full rounded-sm border border-border-strong bg-surface-1 py-2 pr-3 pl-9 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
              />
              <ul className="mt-1 max-h-56 overflow-y-auto rounded-md border border-border-default bg-surface-1 shadow-[var(--elevation-md)]">
                {available === null ? (
                  <li className="px-3 py-2 text-sm text-neutral-500">Cargando asesores…</li>
                ) : filtered.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-neutral-500">Todos los asesores reales ya tienen ficha.</li>
                ) : (
                  filtered.map((a) => (
                    <li key={a.workspaceId}>
                      <button
                        type="button"
                        onClick={() => {
                          setPicked(a);
                          setQuery("");
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
                      >
                        <Avatar name={a.name} src={a.avatarUrl} size={24} />
                        <span className="truncate">{a.name}</span>
                        <span className="truncate text-xs text-neutral-500">{a.email}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="my-1 h-px bg-border-default" />
        <p className="text-xs font-medium tracking-wide text-neutral-400 uppercase">Datos de agencia</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Profesión" value={profession} onChange={(e) => setProfession(e.target.value)} placeholder="Asesor Financiero" />
          <Input label="Aseguradora" value={insurer} onChange={(e) => setInsurer(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="País" value={country} onChange={(e) => setCountry(e.target.value)} />
          <Input label="Ciudad" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>

        <div className="my-1 h-px bg-border-default" />
        <p className="text-xs font-medium tracking-wide text-neutral-400 uppercase">Contrato inicial</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Inicio" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="Fin" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Valor total (USD)" type="number" value={totalValue} onChange={(e) => setTotalValue(e.target.value)} />
          <Input label="Valor mensual (USD)" type="number" value={monthlyValue} onChange={(e) => setMonthlyValue(e.target.value)} />
        </div>
        <Input label="Modelo de comisión" value={commissionModel} onChange={(e) => setCommissionModel(e.target.value)} placeholder="20% sobre pólizas cerradas" />

        <Button onClick={handleSubmit} loading={saving} className="mt-2">
          Crear ficha
        </Button>
      </div>
    </Sheet>
  );
}
