"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { updateClientAction } from "@/lib/clients/actions";
import type { ClientProfile } from "@/lib/clients/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";

const SERVICE_TYPE_OPTIONS = [
  { value: "linkedin_leadgen", label: "Growth Link LinkedIn" },
  { value: "crm", label: "Growth Link CRM" },
  { value: "ambos", label: "Growth Link Hybrid" },
  { value: "otro", label: "Otro" },
];

/** Formulario para updateClientAction — existía la acción desde la Fase 1
 * pero nunca tuvo un botón/UI que la disparara; la referencia visual
 * muestra "Editar cliente" en el header en todas las pestañas. */
export function EditClientSheet({ client, members, onClose, onSaved }: { client: ClientProfile; members: WorkspaceMemberOption[]; onClose: () => void; onSaved: () => void }) {
  const [profession, setProfession] = useState(client.profession ?? "");
  const [insurer, setInsurer] = useState(client.insurer ?? "");
  const [country, setCountry] = useState(client.country ?? "");
  const [city, setCity] = useState(client.city ?? "");
  const [serviceType, setServiceType] = useState(client.serviceType);
  const [linkedinProfileUrl, setLinkedinProfileUrl] = useState(client.linkedinProfileUrl ?? "");
  const [linkedinSalesNavigatorUrl, setLinkedinSalesNavigatorUrl] = useState(client.linkedinSalesNavigatorUrl ?? "");
  const [calendlyUrl, setCalendlyUrl] = useState(client.calendlyUrl ?? "");
  const [setterId, setSetterId] = useState(client.setterId ?? "");
  const [accountManagerId, setAccountManagerId] = useState(client.accountManagerId ?? "");
  const [trafficManagerId, setTrafficManagerId] = useState(client.trafficManagerId ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        await updateClientAction(client.id, {
          profession,
          insurer,
          country,
          city,
          serviceType,
          linkedinProfileUrl,
          linkedinSalesNavigatorUrl,
          calendlyUrl,
          setterId: setterId || null,
          accountManagerId: accountManagerId || null,
          trafficManagerId: trafficManagerId || null,
        });
        toast.success("Asesor actualizado.");
        onSaved();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar el asesor.");
      }
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Pencil className="size-4" aria-hidden="true" />
          Editar cliente
        </span>
      }
    >
      <div className="flex flex-col gap-4 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Datos generales</p>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Profesión" value={profession} onChange={(e) => setProfession(e.target.value)} />
          <Input label="Aseguradora" value={insurer} onChange={(e) => setInsurer(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="País" value={country} onChange={(e) => setCountry(e.target.value)} />
          <Input label="Ciudad" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        <Select label="Tipo de servicio" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
          {SERVICE_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>

        <div className="my-1 h-px bg-border-default" />
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Enlaces</p>
        <Input label="Perfil de LinkedIn" value={linkedinProfileUrl} onChange={(e) => setLinkedinProfileUrl(e.target.value)} placeholder="https://linkedin.com/in/…" />
        <Input label="LinkedIn Sales Navigator" value={linkedinSalesNavigatorUrl} onChange={(e) => setLinkedinSalesNavigatorUrl(e.target.value)} placeholder="https://linkedin.com/sales/…" />
        <Input label="Calendly" value={calendlyUrl} onChange={(e) => setCalendlyUrl(e.target.value)} placeholder="https://calendly.com/…" />

        <div className="my-1 h-px bg-border-default" />
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Equipo asignado</p>
        <Select label="Setter" value={setterId} onChange={(e) => setSetterId(e.target.value)}>
          <option value="">Sin asignar</option>
          {members.map((m) => (
            <option key={m.memberId} value={m.memberId}>
              {m.fullName}
            </option>
          ))}
        </Select>
        <Select label="Traffic Manager" value={trafficManagerId} onChange={(e) => setTrafficManagerId(e.target.value)}>
          <option value="">Sin asignar</option>
          {members.map((m) => (
            <option key={m.memberId} value={m.memberId}>
              {m.fullName}
            </option>
          ))}
        </Select>
        <Select label="Account Manager" value={accountManagerId} onChange={(e) => setAccountManagerId(e.target.value)}>
          <option value="">Sin asignar</option>
          {members.map((m) => (
            <option key={m.memberId} value={m.memberId}>
              {m.fullName}
            </option>
          ))}
        </Select>

        <Button onClick={handleSave} loading={isPending} className="mt-2 self-start">
          Guardar cambios
        </Button>
      </div>
    </Sheet>
  );
}
