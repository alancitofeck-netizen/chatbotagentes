"use client";

import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { toast } from "@/components/toast/toast";
import { getContactListAction } from "@/lib/contacts/actions";
import type { ContactListItem } from "@/lib/contacts/queries";
import { createClientAction } from "@/lib/clients/actions";

interface PickedContact {
  id: string;
  name: string;
  company: string | null;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Wizard de creación — mismo espíritu que ContactPicker.tsx (Calendario):
 * hand-rolled search-and-pick combobox, no hay primitivo formal en
 * src/components/ui/. Si no elige un contacto existente, arma uno nuevo
 * inline (createClientAction lo resuelve via findOrCreateContact). */
export function NewClientWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [picked, setPicked] = useState<PickedContact | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactListItem[]>([]);
  const [open, setOpen] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

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
    if (debounce.current) clearTimeout(debounce.current);
    if (!query.trim()) return;
    debounce.current = setTimeout(() => {
      getContactListAction({ search: query }).then((fresh) => {
        setResults(fresh);
        setOpen(true);
      });
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  async function handleSubmit() {
    if (!picked && !newName.trim() && !newPhone.trim() && !newEmail.trim()) {
      toast.error("Elegí un contacto existente o completá los datos de uno nuevo.");
      return;
    }
    if (!startDate || !endDate) {
      toast.error("Completá las fechas del contrato.");
      return;
    }
    setSaving(true);
    try {
      await createClientAction({
        contactId: picked?.id ?? null,
        contactName: newName || undefined,
        contactPhone: newPhone || undefined,
        contactEmail: newEmail || undefined,
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
      toast.success("Cliente creado.");
      onCreated();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el cliente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Nuevo cliente">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Contacto</label>
          {picked ? (
            <div className="flex items-center justify-between rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm">
              <span className="text-foreground">{picked.name}</span>
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
                onFocus={() => results.length > 0 && setOpen(true)}
                placeholder="Buscar contacto existente por nombre, teléfono, empresa…"
                className="w-full rounded-sm border border-border-strong bg-surface-1 py-2 pr-3 pl-9 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
              />
              {open && results.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border-default bg-surface-1 shadow-[var(--elevation-md)]">
                  {results.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setPicked({ id: c.id, name: c.name, company: c.company });
                          setQuery("");
                          setResults([]);
                          setOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
                      >
                        <Avatar name={c.name} src={c.avatarUrl} size={24} />
                        <span className="truncate">{c.name}</span>
                        {c.company && <span className="truncate text-xs text-neutral-500">{c.company}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {!picked && (
          <>
            <p className="text-xs text-neutral-500">O completá los datos para crear un contacto nuevo:</p>
            <Input label="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Teléfono" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              <Input label="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
          </>
        )}

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
          Crear cliente
        </Button>
      </div>
    </Sheet>
  );
}
