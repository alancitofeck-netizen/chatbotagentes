"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import type { AdvisorStage, DealCard } from "@/lib/advisors/queries";
import { createDeal, updateDeal } from "@/lib/advisors/actions";

const CURRENCIES = ["USD", "ARS", "EUR", "MXN"];

export function DealFormSheet({
  card,
  stages,
  defaultStageId,
  members,
  onClose,
  onSaved,
}: {
  card: DealCard | null;
  stages: AdvisorStage[];
  defaultStageId: string | null;
  members: WorkspaceMemberOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = card !== null;
  const [name, setName] = useState(card?.contactName ?? "");
  const [phone, setPhone] = useState(card?.phone ?? "");
  const [email, setEmail] = useState(card?.email ?? "");
  const [company, setCompany] = useState(card?.company ?? "");
  const [title, setTitle] = useState(card?.title ?? "");
  const [value, setValue] = useState(String(card?.value ?? ""));
  const [currency, setCurrency] = useState(card?.currency ?? "USD");
  const [policyType, setPolicyType] = useState(card?.policyType ?? "");
  const [renewalDate, setRenewalDate] = useState(card?.renewalDate ?? "");
  const [commission, setCommission] = useState(card?.commission !== null && card?.commission !== undefined ? String(card.commission) : "");
  const [ownerId, setOwnerId] = useState(card?.ownerId ?? "");
  const [stageId, setStageId] = useState(defaultStageId ?? stages[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    const input = {
      name,
      phone,
      email,
      company,
      title,
      value: Number(value) || 0,
      currency,
      policyType,
      renewalDate,
      commission: commission.trim() ? Number(commission) : null,
      ownerId: ownerId || null,
    };

    startTransition(async () => {
      try {
        if (isEdit && card) {
          await updateDeal(card.id, card.contactId, input);
        } else {
          await createDeal(input, stageId || undefined);
        }
        toast.success(isEdit ? "Póliza actualizada." : "Póliza creada.");
        onSaved();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar la póliza.");
      }
    });
  }

  return (
    <Sheet open onClose={onClose} title={isEdit ? "Editar póliza" : "Nueva póliza"}>
      <div className="flex flex-col gap-4 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Cliente</p>
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <Input label="Empresa" value={company} onChange={(e) => setCompany(e.target.value)} />

        <div className="my-1 h-px bg-border-default" />
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Póliza</p>
        <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Seguro de vida — Nombre del cliente" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Valor" type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
          <Select label="Moneda" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <Input label="Tipo de póliza / producto" value={policyType} onChange={(e) => setPolicyType(e.target.value)} placeholder="Ej. Vida, Salud, Retiro" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Fecha de renovación" type="date" value={renewalDate} onChange={(e) => setRenewalDate(e.target.value)} />
          <Input label="Comisión" type="number" min={0} value={commission} onChange={(e) => setCommission(e.target.value)} />
        </div>
        {!isEdit && (
          <Select label="Etapa inicial" value={stageId} onChange={(e) => setStageId(e.target.value)}>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        )}
        <Select label="Agente responsable" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
          <option value="">Sin asignar</option>
          {members.map((m) => (
            <option key={m.memberId} value={m.memberId}>
              {m.fullName}
            </option>
          ))}
        </Select>

        <Button onClick={handleSave} loading={isPending}>
          {isEdit ? "Guardar cambios" : "Crear póliza"}
        </Button>
      </div>
    </Sheet>
  );
}
