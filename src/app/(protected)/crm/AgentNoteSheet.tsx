"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { AgentListItem } from "@/lib/agents/queries";
import { addAgentNote } from "@/lib/agents/actions";

export function AgentNoteSheet({ agent, onClose }: { agent: AgentListItem | null; onClose: () => void }) {
  const [body, setBody] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!agent) return null;

  function handleAdd() {
    if (!agent || !body.trim()) return;
    startTransition(async () => {
      try {
        await addAgentNote(agent.memberId, body);
        toast.success("Nota agregada.");
        setBody("");
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo agregar la nota.");
      }
    });
  }

  return (
    <Sheet open onClose={onClose} title={`Nota — ${agent.fullName}`}>
      <div className="flex flex-col gap-4 p-5">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          placeholder="Ej. Excelente desempeño esta semana."
          className="w-full rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />
        <Button onClick={handleAdd} loading={isPending}>
          Agregar nota
        </Button>
      </div>
    </Sheet>
  );
}
