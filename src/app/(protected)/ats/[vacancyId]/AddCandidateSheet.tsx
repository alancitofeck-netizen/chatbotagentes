"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { addCandidateToVacancy } from "@/lib/ats/actions";

export function AddCandidateSheet({
  vacancyId,
  open,
  onClose,
  onAdded,
}: {
  vacancyId: string;
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName("");
    setPhone("");
    setEmail("");
    setSource("");
  }

  function handleAdd() {
    if (!name.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    startTransition(async () => {
      try {
        await addCandidateToVacancy(vacancyId, { name, phone, email, source });
        toast.success("Candidato agregado.");
        reset();
        onAdded();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo agregar el candidato.");
      }
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Agregar candidato">
      <div className="flex flex-col gap-4 p-5">
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" />
        <Input label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+549..." />
        <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="candidato@email.com" />
        <Input label="Origen" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Ej. LinkedIn, referido" />
        <Button onClick={handleAdd} loading={isPending}>
          Agregar candidato
        </Button>
      </div>
    </Sheet>
  );
}
