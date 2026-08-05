"use client";

import { useEffect, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { toast } from "@/components/toast/toast";
import { getPolicyOptionsForCollectionAction, createCollectionAction } from "@/lib/collections/actions";

interface PolicyOption {
  id: string;
  label: string;
  currency: string;
}

export function CollectionFormSheet({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [policies, setPolicies] = useState<PolicyOption[] | null>(null);
  const [policyId, setPolicyId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPolicyOptionsForCollectionAction().then((opts) => {
      setPolicies(opts);
      if (opts.length > 0) {
        setPolicyId(opts[0].id);
        setCurrency(opts[0].currency);
      }
    });
  }, []);

  function handlePolicyChange(id: string) {
    setPolicyId(id);
    const found = policies?.find((p) => p.id === id);
    if (found) setCurrency(found.currency);
  }

  async function handleSave() {
    if (!policyId) {
      toast.error("Elegí una póliza.");
      return;
    }
    if (!dueDate) {
      toast.error("La fecha de vencimiento es obligatoria.");
      return;
    }
    const amountValue = Number(amount);
    if (!amountValue || amountValue <= 0) {
      toast.error("Ingresá un monto válido.");
      return;
    }
    setSaving(true);
    try {
      await createCollectionAction({ policyId, dueDate, amount: amountValue, currency, notes: notes || null });
      toast.success("Cobro creado.");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el cobro.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Nuevo cobro">
      <div className="flex flex-col gap-4 p-5">
        {!policies ? (
          <Skeleton className="h-40 w-full" />
        ) : policies.length === 0 ? (
          <p className="text-sm text-neutral-500">Todavía no hay pólizas cargadas — creá una póliza primero desde el módulo Pólizas.</p>
        ) : (
          <>
            <Select label="Póliza" value={policyId} onChange={(e) => handlePolicyChange(e.target.value)}>
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </Select>
            <Input label="Vencimiento" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <div className="flex gap-2">
              <Input label="Monto" type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} containerClassName="flex-1" />
              <Input label="Moneda" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} containerClassName="w-24" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
              />
            </div>
            <Button onClick={handleSave} loading={saving}>
              Crear cobro
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}
