"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { toast } from "@/components/toast/toast";
import { tagBadgeVariant } from "@/app/(protected)/inbox/tagColor";
import { toggleContactTag } from "@/lib/inbox/actions";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import type { OpportunityCard, OpportunityTag, PipelineStage } from "@/lib/crm/queries";
import { createOpportunity, updateOpportunity } from "@/lib/crm/actions";

const CURRENCIES = ["USD", "ARS", "EUR", "MXN"];

export function LeadFormSheet({
  card,
  stages,
  defaultStageId,
  members,
  tags,
  onClose,
  onSaved,
}: {
  card: OpportunityCard | null;
  stages: PipelineStage[];
  defaultStageId: string | null;
  members: WorkspaceMemberOption[];
  tags: OpportunityTag[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = card !== null;
  const [name, setName] = useState(card?.contactName ?? "");
  const [phone, setPhone] = useState(card?.phone ?? "");
  const [email, setEmail] = useState(card?.email ?? "");
  const [company, setCompany] = useState(card?.company ?? "");
  const [jobTitle, setJobTitle] = useState(card?.jobTitle ?? "");
  const [source, setSource] = useState(card?.source ?? "");
  const [title, setTitle] = useState(card?.title ?? "");
  const [value, setValue] = useState(String(card?.value ?? ""));
  const [currency, setCurrency] = useState(card?.currency ?? "USD");
  const [priority, setPriority] = useState<"high" | "medium" | "low">(card?.priority ?? "medium");
  const [probability, setProbability] = useState(card?.probability !== null && card?.probability !== undefined ? String(card.probability) : "");
  const [expectedCloseDate, setExpectedCloseDate] = useState(card?.expectedCloseDate ?? "");
  const [ownerId, setOwnerId] = useState(card?.ownerId ?? "");
  const [stageId, setStageId] = useState(defaultStageId ?? stages[0]?.id ?? "");
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set(card?.tags.map((t) => t.id) ?? []));
  const [isPending, startTransition] = useTransition();

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  }

  function handleSave() {
    const input = {
      name,
      phone,
      email,
      company,
      jobTitle,
      source,
      title,
      value: Number(value) || 0,
      currency,
      priority,
      probability: probability.trim() ? Number(probability) : null,
      expectedCloseDate: expectedCloseDate.trim() || null,
      ownerId: ownerId || null,
    };

    startTransition(async () => {
      try {
        let contactId: string;
        if (isEdit && card) {
          await updateOpportunity(card.id, card.contactId, input);
          contactId = card.contactId;
        } else {
          const created = await createOpportunity(input, stageId || undefined);
          contactId = created.contactId;
        }

        const previousTagIds = new Set(card?.tags.map((t) => t.id) ?? []);
        const tagChanges: Promise<unknown>[] = [];
        for (const tagId of selectedTagIds) {
          if (!previousTagIds.has(tagId)) tagChanges.push(toggleContactTag(contactId, tagId, true));
        }
        for (const tagId of previousTagIds) {
          if (!selectedTagIds.has(tagId)) tagChanges.push(toggleContactTag(contactId, tagId, false));
        }
        await Promise.all(tagChanges);

        toast.success(isEdit ? "Lead actualizado." : "Lead creado.");
        onSaved();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar el lead.");
      }
    });
  }

  return (
    <Sheet open onClose={onClose} title={isEdit ? "Editar lead" : "Nuevo lead"}>
      <div className="flex flex-col gap-4 p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Contacto</p>
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Empresa" value={company} onChange={(e) => setCompany(e.target.value)} />
          <Input label="Cargo" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
        </div>
        <Input label="Fuente del lead" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Ej. LinkedIn, referido, web" />

        <div className="my-1 h-px bg-border-default" />
        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Oportunidad</p>
        <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Plan premium — Nombre del cliente" />
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
        <div className="grid grid-cols-2 gap-3">
          <Select label="Prioridad" value={priority} onChange={(e) => setPriority(e.target.value as "high" | "medium" | "low")}>
            <option value="high">Alta</option>
            <option value="medium">Media</option>
            <option value="low">Baja</option>
          </Select>
          <Input
            label="Probabilidad de cierre (%)"
            type="number"
            min={0}
            max={100}
            value={probability}
            onChange={(e) => setProbability(e.target.value)}
          />
        </div>
        <Input
          label="Fecha de cierre estimada"
          type="date"
          value={expectedCloseDate}
          onChange={(e) => setExpectedCloseDate(e.target.value)}
        />
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

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Etiquetas</label>
          <div className="flex flex-wrap gap-1.5">
            {tags.length === 0 && <p className="text-xs text-neutral-500">Todavía no hay etiquetas en el workspace.</p>}
            {tags.map((tag) => (
              <button key={tag.id} type="button" onClick={() => toggleTag(tag.id)} className={selectedTagIds.has(tag.id) ? "" : "opacity-40"}>
                <Badge variant={tagBadgeVariant(tag.color)}>{tag.name}</Badge>
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleSave} loading={isPending}>
          {isEdit ? "Guardar cambios" : "Crear lead"}
        </Button>
      </div>
    </Sheet>
  );
}
