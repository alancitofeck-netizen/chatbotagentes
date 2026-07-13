"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { createBooking } from "@/lib/calendar/actions";
import { ContactPicker, type PickedContact } from "./ContactPicker";

function defaultStart() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function toLocalValue(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreateBookingSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [contact, setContact] = useState<PickedContact | null>(null);
  const [subject, setSubject] = useState("");
  const [startValue, setStartValue] = useState(() => toLocalValue(defaultStart()));
  const [endValue, setEndValue] = useState(() => {
    const d = defaultStart();
    d.setMinutes(d.getMinutes() + 30);
    return toLocalValue(d);
  });
  const [isPending, startTransition] = useTransition();

  function reset() {
    setContact(null);
    setSubject("");
    setStartValue(toLocalValue(defaultStart()));
  }

  function handleCreate() {
    if (!contact) {
      toast.error("Seleccioná un contacto.");
      return;
    }
    startTransition(async () => {
      try {
        await createBooking({
          contactId: contact.id,
          subject,
          startTime: new Date(startValue).toISOString(),
          endTime: new Date(endValue).toISOString(),
        });
        toast.success("Reunión agendada.");
        reset();
        onCreated();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo agendar la reunión.");
      }
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nueva reunión">
      <div className="flex flex-col gap-4 p-5">
        <ContactPicker selected={contact} onSelect={setContact} />
        <Input label="Asunto" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ej. Demo, seguimiento…" />
        <Input
          label="Inicio"
          type="datetime-local"
          value={startValue}
          onChange={(e) => setStartValue(e.target.value)}
        />
        <Input label="Fin" type="datetime-local" value={endValue} onChange={(e) => setEndValue(e.target.value)} />
        <Button onClick={handleCreate} loading={isPending}>
          Agendar
        </Button>
      </div>
    </Sheet>
  );
}
