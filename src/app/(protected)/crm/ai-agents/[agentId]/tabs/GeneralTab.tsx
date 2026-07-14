"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { AiAgentDetail, BusinessHoursConfig } from "@/lib/ai-agents/queries";
import { updateAiAgentGeneral } from "@/lib/ai-agents/actions";

const MODELS = [
  "openai/gpt-4o-mini",
  "openai/gpt-4o",
  "anthropic/claude-3.5-haiku",
  "anthropic/claude-3.5-sonnet",
  "google/gemini-2.0-flash-001",
];

const TIMEZONES = ["America/Argentina/Buenos_Aires", "America/Santiago", "America/Sao_Paulo", "America/Bogota", "America/Mexico_City", "UTC"];
const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export function GeneralTab({ agent }: { agent: AiAgentDetail }) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [model, setModel] = useState(agent.model);
  const [temperature, setTemperature] = useState(agent.temperature);
  const [maxTokens, setMaxTokens] = useState(agent.maxTokens);
  const [responseMode, setResponseMode] = useState(agent.responseMode);
  const [businessHours, setBusinessHours] = useState<BusinessHoursConfig>(agent.businessHours);
  const [isPending, startTransition] = useTransition();

  function toggleDay(day: number) {
    setBusinessHours((prev) => ({
      ...prev,
      days: prev.days.includes(day) ? prev.days.filter((d) => d !== day) : [...prev.days, day].sort(),
    }));
  }

  function handleSave() {
    if (!name.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    startTransition(async () => {
      try {
        await updateAiAgentGeneral(agent.id, { name, description, model, temperature, maxTokens, businessHours, responseMode });
        toast.success("Cambios guardados.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Información general" />
        <div className="flex flex-col gap-4">
          <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} />
          <div>
            <label className="text-sm font-medium text-foreground">Descripción</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1.5 w-full rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
            />
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Modelo" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Select label="Modelo de OpenRouter" value={model} onChange={(e) => setModel(e.target.value)}>
            {MODELS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Select>
          <div>
            <label className="text-sm font-medium text-foreground">Temperatura ({temperature.toFixed(1)})</label>
            <input
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="mt-3 w-full"
            />
          </div>
          <Input
            label="Máximo de tokens"
            type="number"
            min={1}
            value={maxTokens}
            onChange={(e) => setMaxTokens(Number(e.target.value) || 1)}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Modo de respuesta" />
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setResponseMode("auto")}
            className={`flex-1 rounded-lg border px-4 py-3 text-left text-sm ${responseMode === "auto" ? "border-accent-500 bg-accent-50" : "border-border-default"}`}
          >
            <p className="font-medium text-foreground">Automática</p>
            <p className="text-xs text-neutral-500">El agente responde directamente al contacto.</p>
          </button>
          <button
            type="button"
            onClick={() => setResponseMode("assisted")}
            className={`flex-1 rounded-lg border px-4 py-3 text-left text-sm ${responseMode === "assisted" ? "border-accent-500 bg-accent-50" : "border-border-default"}`}
          >
            <p className="font-medium text-foreground">Asistida</p>
            <p className="text-xs text-neutral-500">Genera una sugerencia — un humano la aprueba/edita antes de enviarla.</p>
          </button>
        </div>
      </Card>

      <Card>
        <CardHeader title="Horario de funcionamiento" />
        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={businessHours.enabled}
              onChange={(e) => setBusinessHours((prev) => ({ ...prev, enabled: e.target.checked }))}
            />
            Restringir a un horario específico
          </label>
          {businessHours.enabled && (
            <div className="flex flex-col gap-4">
              <Select
                label="Zona horaria"
                value={businessHours.timezone}
                onChange={(e) => setBusinessHours((prev) => ({ ...prev, timezone: e.target.value }))}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
              <div className="flex flex-wrap gap-2">
                {DAY_LABELS.map((label, day) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => toggleDay(day)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${businessHours.days.includes(day) ? "bg-accent-500 text-white" : "bg-surface-3 text-neutral-500"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Desde"
                  type="time"
                  value={businessHours.start}
                  onChange={(e) => setBusinessHours((prev) => ({ ...prev, start: e.target.value }))}
                />
                <Input
                  label="Hasta"
                  type="time"
                  value={businessHours.end}
                  onChange={(e) => setBusinessHours((prev) => ({ ...prev, end: e.target.value }))}
                />
              </div>
            </div>
          )}
        </div>
      </Card>

      <div>
        <Button onClick={handleSave} loading={isPending}>
          Guardar cambios
        </Button>
      </div>
    </div>
  );
}
