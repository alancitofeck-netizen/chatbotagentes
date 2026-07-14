"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { createAutomation } from "@/lib/automations/actions";

export function CreateAutomationSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [keyword, setKeyword] = useState("");
  const [responseBody, setResponseBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName("");
    setKeyword("");
    setResponseBody("");
  }

  function handleCreate() {
    if (!name.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    if (!keyword.trim()) {
      toast.error("La palabra clave es obligatoria.");
      return;
    }
    startTransition(async () => {
      try {
        await createAutomation({ name, keyword, responseBody });
        toast.success("Automatización creada.");
        reset();
        onCreated();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear la automatización.");
      }
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nueva automatización">
      <div className="flex flex-col gap-4 p-5">
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Saludo inicial" />
        <Input
          label="Palabra clave (trigger)"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="Ej. horarios"
        />
        <Input
          label="Respuesta (acción)"
          value={responseBody}
          onChange={(e) => setResponseBody(e.target.value)}
          placeholder="Texto que se guardaría como respuesta"
        />
        <Button onClick={handleCreate} loading={isPending}>
          Crear automatización
        </Button>
      </div>
    </Sheet>
  );
}
