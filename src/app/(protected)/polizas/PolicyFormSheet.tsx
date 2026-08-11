"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import type { PolicyDetail, InsuranceType } from "@/lib/policies/queries";
import { createPolicyAction, updatePolicyAction, type PolicyFormInput } from "@/lib/policies/actions";

const CURRENCIES = ["USD", "ARS", "EUR", "MXN"];
const INSURANCE_TYPES: { value: InsuranceType; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "hogar", label: "Hogar" },
  { value: "vida", label: "Vida" },
  { value: "otro", label: "Otro" },
];
const PAYMENT_FREQUENCIES = [
  { value: "", label: "Sin especificar" },
  { value: "mensual", label: "Mensual" },
  { value: "trimestral", label: "Trimestral" },
  { value: "semestral", label: "Semestral" },
  { value: "anual", label: "Anual" },
  { value: "unico", label: "Pago único" },
];

export interface PolicyFormDefaultContact {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
}

export function PolicyFormSheet({
  policy,
  defaultContact,
  initialClientId,
  members,
  onClose,
  onSaved,
}: {
  policy: PolicyDetail | null;
  /** Prellena el cliente cuando se llega desde el deep-link del Inbox
   * (ContactInfoPanel.tsx's "Nueva póliza", ?createContact=...) — solo
   * aplica en alta, se ignora si `policy` ya trae sus propios datos. */
  defaultContact?: PolicyFormDefaultContact | null;
  /** Cuando se abre desde la pestaña Pólizas de un Cliente (Clientes >
   * [clientId] > Pólizas) — nunca editable en el formulario, solo viaja al
   * crear para que policies.client_id quede seteado (ver PolicyFormInput). */
  initialClientId?: string | null;
  members: WorkspaceMemberOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = policy !== null;
  const [contactName, setContactName] = useState(policy?.contactName ?? defaultContact?.name ?? "");
  const [contactPhone, setContactPhone] = useState(policy?.contactPhone ?? defaultContact?.phone ?? "");
  const [contactEmail, setContactEmail] = useState(policy?.contactEmail ?? defaultContact?.email ?? "");
  const [policyNumber, setPolicyNumber] = useState(policy?.policyNumber ?? "");
  const [company, setCompany] = useState(policy?.company ?? "");
  const [product, setProduct] = useState(policy?.product ?? "");
  const [insuranceType, setInsuranceType] = useState<InsuranceType>(policy?.insuranceType ?? "auto");
  const [startDate, setStartDate] = useState(policy?.startDate ?? "");
  const [endDate, setEndDate] = useState(policy?.endDate ?? "");
  const [premium, setPremium] = useState(policy?.premium !== null && policy?.premium !== undefined ? String(policy.premium) : "");
  const [premiumCurrency, setPremiumCurrency] = useState(policy?.premiumCurrency ?? "USD");
  const [paymentFrequency, setPaymentFrequency] = useState(policy?.paymentFrequency ?? "");
  const [commissionAmount, setCommissionAmount] = useState(
    policy?.commissionAmount !== null && policy?.commissionAmount !== undefined ? String(policy.commissionAmount) : "",
  );
  const [ownerId, setOwnerId] = useState(policy?.ownerName ? (members.find((m) => m.fullName === policy.ownerName)?.memberId ?? "") : "");
  const [notes, setNotes] = useState(policy?.notes ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!company.trim()) {
      toast.error("La compañía es obligatoria.");
      return;
    }
    if (!isEdit && !contactName.trim() && !contactPhone.trim() && !contactEmail.trim()) {
      toast.error("Ingresá al menos el nombre, teléfono o email del cliente.");
      return;
    }

    const input: PolicyFormInput = {
      contactId: policy?.contactId ?? defaultContact?.id ?? null,
      contactName,
      contactPhone,
      contactEmail,
      policyNumber,
      company,
      product,
      insuranceType,
      issueDate: null,
      startDate: startDate || null,
      endDate: endDate || null,
      premium: premium.trim() ? Number(premium) : null,
      premiumCurrency,
      paymentFrequency: paymentFrequency || null,
      commissionAmount: commissionAmount.trim() ? Number(commissionAmount) : null,
      commissionStatus: null,
      sumInsured: null,
      deductible: null,
      beneficiaries: policy?.beneficiaries ?? [],
      typeDetails: policy?.typeDetails ?? {},
      notes,
      ownerId: ownerId || null,
      clientId: isEdit ? undefined : initialClientId,
    };

    startTransition(async () => {
      try {
        if (isEdit && policy) {
          await updatePolicyAction(policy.id, input);
        } else {
          await createPolicyAction(input);
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
        {!isEdit && (
          <>
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Cliente</p>
            <Input label="Nombre" value={contactName} onChange={(e) => setContactName(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Teléfono" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
              <Input label="Email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </div>
            <div className="my-1 h-px bg-border-default" />
          </>
        )}

        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Póliza</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="N° de póliza" value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} />
          <Select label="Tipo" value={insuranceType} onChange={(e) => setInsuranceType(e.target.value as InsuranceType)}>
            {INSURANCE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </div>
        <Input label="Compañía" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Ej. La Caja, Sancor Seguros" />
        <Input label="Producto" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="Ej. Cobertura todo riesgo" />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Inicio de vigencia" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input label="Vencimiento" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Prima" type="number" min={0} value={premium} onChange={(e) => setPremium(e.target.value)} />
          <Select label="Moneda" value={premiumCurrency} onChange={(e) => setPremiumCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Select label="Frecuencia de pago" value={paymentFrequency} onChange={(e) => setPaymentFrequency(e.target.value)}>
            {PAYMENT_FREQUENCIES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
          <Input label="Comisión" type="number" min={0} value={commissionAmount} onChange={(e) => setCommissionAmount(e.target.value)} />
        </div>

        <Select label="Agente responsable" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
          <option value="">Sin asignar</option>
          {members.map((m) => (
            <option key={m.memberId} value={m.memberId}>
              {m.fullName}
            </option>
          ))}
        </Select>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Notas</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        </label>

        <Button onClick={handleSave} loading={isPending}>
          {isEdit ? "Guardar cambios" : "Crear póliza"}
        </Button>
      </div>
    </Sheet>
  );
}
