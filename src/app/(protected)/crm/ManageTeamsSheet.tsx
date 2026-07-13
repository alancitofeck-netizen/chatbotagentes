"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { AgentListItem, Team } from "@/lib/agents/queries";
import { createTeam, deleteTeam, getTeamsAction } from "@/lib/agents/actions";

export function ManageTeamsSheet({
  open,
  teams,
  agents,
  onClose,
  onChanged,
}: {
  open: boolean;
  teams: Team[];
  agents: AgentListItem[];
  onClose: () => void;
  onChanged: (teams: Team[]) => void;
}) {
  const [name, setName] = useState("");
  const [leaderId, setLeaderId] = useState("");
  const [isPending, startTransition] = useTransition();

  function refetch() {
    startTransition(async () => {
      onChanged(await getTeamsAction());
    });
  }

  function handleCreate() {
    if (!name.trim()) {
      toast.error("El nombre del equipo es obligatorio.");
      return;
    }
    startTransition(async () => {
      try {
        await createTeam(name, leaderId || null);
        toast.success("Equipo creado.");
        setName("");
        setLeaderId("");
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear el equipo.");
      }
    });
  }

  function handleDelete(teamId: string) {
    if (!window.confirm("¿Eliminar este equipo? Los agentes quedarán sin equipo asignado.")) return;
    startTransition(async () => {
      await deleteTeam(teamId);
      toast.success("Equipo eliminado.");
      refetch();
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Gestionar equipos">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-3 rounded-md bg-surface-2 p-3">
          <Input label="Nuevo equipo" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Equipo Norte" />
          <Select label="Líder" value={leaderId} onChange={(e) => setLeaderId(e.target.value)}>
            <option value="">Sin líder</option>
            {agents.map((a) => (
              <option key={a.memberId} value={a.memberId}>
                {a.fullName}
              </option>
            ))}
          </Select>
          <Button size="sm" onClick={handleCreate} loading={isPending}>
            Crear equipo
          </Button>
        </div>

        <ul className="flex flex-col gap-1">
          {teams.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-surface-2">
              <div>
                <p className="text-sm font-medium text-foreground">{t.name}</p>
                {t.leaderName && <p className="text-xs text-neutral-500">Líder: {t.leaderName}</p>}
              </div>
              <button
                type="button"
                aria-label="Eliminar equipo"
                onClick={() => handleDelete(t.id)}
                className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </li>
          ))}
          {teams.length === 0 && <p className="text-sm text-neutral-500">Sin equipos todavía.</p>}
        </ul>
      </div>
    </Sheet>
  );
}
