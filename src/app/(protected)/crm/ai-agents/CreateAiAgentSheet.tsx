"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { createAiAgent } from "@/lib/ai-agents/actions";

export function CreateAiAgentSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [moduleKey, setModuleKey] = useState<"crm" | "ats">("crm");
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    if (!name.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    startTransition(async () => {
      try {
        const { id } = await createAiAgent({ name, description, moduleKey });
        toast.success("Agente creado.");
        router.push(`/crm/ai-agents/${id}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear el agente.");
      }
    });
  }

  return (
    <Sheet open onClose={onClose} title="Nuevo agente IA">
      <div className="flex flex-col gap-4 p-5">
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Asesor comercial" />
        <div>
          <label className="text-sm font-medium text-foreground">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Qué hace este agente…"
            className="mt-1.5 w-full rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        </div>
        <Select label="Módulo" value={moduleKey} onChange={(e) => setModuleKey(e.target.value as "crm" | "ats")}>
          <option value="crm">CRM</option>
          <option value="ats">ATS</option>
        </Select>
        <Button onClick={handleCreate} loading={isPending}>
          Crear agente
        </Button>
      </div>
    </Sheet>
  );
}
