"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { AgentListItem, Team } from "@/lib/agents/queries";
import { setAgentTarget, updateAgentProfile } from "@/lib/agents/actions";

export function AgentEditSheet({
  agent,
  teams,
  agents,
  onClose,
  onChanged,
}: {
  agent: AgentListItem | null;
  teams: Team[];
  agents: AgentListItem[];
  onClose: () => void;
  onChanged: () => void;
}) {
  if (!agent) return null;
  return <AgentEditContent agent={agent} teams={teams} agents={agents} onClose={onClose} onChanged={onChanged} />;
}

function AgentEditContent({
  agent,
  teams,
  agents,
  onClose,
  onChanged,
}: {
  agent: AgentListItem;
  teams: Team[];
  agents: AgentListItem[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [title, setTitle] = useState(agent.title ?? "");
  const [status, setStatus] = useState(agent.status);
  const [teamId, setTeamId] = useState(agent.teamId ?? "");
  const [supervisorId, setSupervisorId] = useState(agent.supervisorId ?? "");
  const [hireDate, setHireDate] = useState(agent.hireDate ?? "");
  const [weeklyTarget, setWeeklyTarget] = useState(String(agent.weeklyTarget ?? ""));
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      try {
        await updateAgentProfile(agent.memberId, {
          title,
          status: status as "active" | "vacation" | "inactive",
          teamId: teamId || null,
          supervisorId: supervisorId || null,
          hireDate: hireDate || null,
        });
        if (weeklyTarget.trim()) {
          await setAgentTarget(agent.memberId, Number(weeklyTarget));
        }
        toast.success("Perfil actualizado.");
        onChanged();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar el perfil.");
      }
    });
  }

  return (
    <Sheet open onClose={onClose} title={agent.fullName}>
      <div className="flex flex-col gap-4 p-5">
        <Input label="Cargo" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Setter, SDR, Closer" />
        <Select
          label="Estado"
          value={status}
          onChange={(e) => setStatus(e.target.value as "active" | "vacation" | "inactive")}
        >
          <option value="active">Activo</option>
          <option value="vacation">Vacaciones</option>
          <option value="inactive">Inactivo</option>
        </Select>
        <Select label="Equipo" value={teamId} onChange={(e) => setTeamId(e.target.value)}>
          <option value="">Sin equipo</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select label="Supervisor" value={supervisorId} onChange={(e) => setSupervisorId(e.target.value)}>
          <option value="">Sin supervisor</option>
          {agents
            .filter((a) => a.memberId !== agent.memberId)
            .map((a) => (
              <option key={a.memberId} value={a.memberId}>
                {a.fullName}
              </option>
            ))}
        </Select>
        <Input label="Fecha de ingreso" type="date" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
        <Input
          label="Meta de reuniones esta semana"
          type="number"
          min={0}
          value={weeklyTarget}
          onChange={(e) => setWeeklyTarget(e.target.value)}
          placeholder="Ej. 20"
        />
        <Button onClick={handleSave} loading={isPending}>
          Guardar cambios
        </Button>
      </div>
    </Sheet>
  );
}
