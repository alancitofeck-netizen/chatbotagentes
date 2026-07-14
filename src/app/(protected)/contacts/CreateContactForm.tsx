"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { createContact } from "@/lib/contacts/actions";

export function CreateContactForm({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [source, setSource] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName("");
    setPhone("");
    setEmail("");
    setCompany("");
    setSource("");
  }

  function handleCreate() {
    if (!name.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    startTransition(async () => {
      try {
        const { id } = await createContact({ name, phone, email, company, source });
        toast.success("Contacto creado.");
        reset();
        onCreated(id);
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear el contacto.");
      }
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nuevo contacto">
      <div className="flex flex-col gap-4 p-5">
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" />
        <Input label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+549..." />
        <Input
          label="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="contacto@email.com"
        />
        <Input label="Empresa" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Ej. Nombre de la empresa" />
        <Input label="Origen" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Ej. WhatsApp, referido" />
        <Button onClick={handleCreate} loading={isPending}>
          Crear contacto
        </Button>
      </div>
    </Sheet>
  );
}
