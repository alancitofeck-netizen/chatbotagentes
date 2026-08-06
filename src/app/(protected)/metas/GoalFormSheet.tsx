"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { createGoalAction, type GoalFormInput } from "@/lib/goals/actions";
import { GOAL_METRIC_KEYS, GOAL_METRIC_META, type GoalKind, type GoalMetricKey } from "@/lib/goals/constants";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function endOfMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
}

export function GoalFormSheet({ goalKind, members, onClose, onSaved }: { goalKind: GoalKind; members: WorkspaceMemberOption[]; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [metricKey, setMetricKey] = useState<GoalMetricKey>("premium_issued");
  const [rewardLabel, setRewardLabel] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [periodStart, setPeriodStart] = useState(todayIso());
  const [periodEnd, setPeriodEnd] = useState(endOfMonthIso());
  const [scope, setScope] = useState<"team" | "individual">("individual");
  const [memberId, setMemberId] = useState(members[0]?.memberId ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Ponele un nombre al objetivo.");
      return;
    }
    const value = Number(targetValue);
    if (!value || value <= 0) {
      toast.error("Ingresá un objetivo numérico válido.");
      return;
    }
    setSaving(true);
    const input: GoalFormInput = {
      name,
      metricKey,
      goalKind,
      rewardLabel: goalKind === "bono" ? rewardLabel : null,
      targetValue: value,
      periodStart,
      periodEnd,
      memberId: scope === "individual" ? memberId || null : null,
    };
    try {
      await createGoalAction(input);
      toast.success(goalKind === "bono" ? "Bono creado." : "Meta creada.");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el objetivo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={goalKind === "bono" ? "Crear bono" : "Crear meta"}>
      <div className="flex flex-col gap-4 p-5">
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder={goalKind === "bono" ? "Ej. Bono Vida · GNP" : "Ej. MDRT 2026"} />

        <Select label="Métrica" value={metricKey} onChange={(e) => setMetricKey(e.target.value as GoalMetricKey)}>
          {GOAL_METRIC_KEYS.map((k) => (
            <option key={k} value={k}>
              {GOAL_METRIC_META[k].label}
            </option>
          ))}
        </Select>

        <Input label="Objetivo" type="number" min="0" step="0.01" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />

        {goalKind === "bono" && <Input label="Recompensa" value={rewardLabel} onChange={(e) => setRewardLabel(e.target.value)} placeholder="Ej. $500 de bono" />}

        <div className="grid grid-cols-2 gap-3">
          <Input label="Inicio del período" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
          <Input label="Fin del período" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </div>

        <Select label="Alcance" value={scope} onChange={(e) => setScope(e.target.value as "team" | "individual")}>
          <option value="individual">Un asesor</option>
          <option value="team">Todo el equipo</option>
        </Select>

        {scope === "individual" && (
          <Select label="Asesor" value={memberId} onChange={(e) => setMemberId(e.target.value)}>
            {members.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.fullName}
              </option>
            ))}
          </Select>
        )}

        <Button onClick={handleSave} loading={saving} className="mt-2">
          {goalKind === "bono" ? "Crear bono" : "Crear meta"}
        </Button>
      </div>
    </Sheet>
  );
}
