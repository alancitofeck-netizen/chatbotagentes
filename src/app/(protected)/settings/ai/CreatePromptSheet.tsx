"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { createPrompt } from "@/lib/ai-settings/actions";

export function CreatePromptSheet({
  open,
  moduleKey,
  onClose,
  onCreated,
}: {
  open: boolean;
  moduleKey: "crm" | "ats";
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName("");
    setSystemPrompt("");
  }

  function handleCreate() {
    if (!name.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    startTransition(async () => {
      try {
        await createPrompt({ moduleKey, name, systemPrompt });
        toast.success("Prompt creado.");
        reset();
        onCreated();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear el prompt.");
      }
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nuevo prompt">
      <div className="flex flex-col gap-4 p-5">
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Modo Setter" />
        <div>
          <label className="text-sm font-medium text-foreground">Prompt de sistema</label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={8}
            placeholder="Instrucciones para el agente…"
            className="mt-1.5 w-full rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        </div>
        <Button onClick={handleCreate} loading={isPending}>
          Crear prompt
        </Button>
      </div>
    </Sheet>
  );
}
