"use client";

import { useState, useTransition } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Calendar, MessageSquare, StickyNote, Trophy, Users } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { AgentDetail } from "@/lib/agents/queries";
import { addAgentNote } from "@/lib/agents/actions";

const STATUS_LABEL: Record<string, { label: string; variant: "success" | "warning" | "neutral" }> = {
  active: { label: "Activo", variant: "success" },
  vacation: { label: "Vacaciones", variant: "warning" },
  inactive: { label: "Inactivo", variant: "neutral" },
};

const ACTIVITY_ICON: Record<string, typeof Users> = {
  conversation: Users,
  meeting: Calendar,
  note: StickyNote,
  opportunity: Trophy,
};

function scoreColor(score: number): string {
  if (score >= 85) return "var(--color-success-strong)";
  if (score >= 70) return "var(--color-warning-strong)";
  if (score >= 50) return "#C2650A";
  return "var(--color-error-strong)";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const chartTooltipStyle = {
  background: "var(--surface-1)",
  border: "1px solid var(--border-default)",
  borderRadius: 12,
  fontSize: 12,
  boxShadow: "var(--elevation-md)",
};

export function AgentProfileView({ agent }: { agent: AgentDetail }) {
  const [notes, setNotes] = useState(agent.notes);
  const [noteBody, setNoteBody] = useState("");
  const [isPending, startTransition] = useTransition();
  const statusInfo = STATUS_LABEL[agent.status] ?? STATUS_LABEL.active;

  function handleAddNote() {
    if (!noteBody.trim()) return;
    const body = noteBody.trim();
    setNoteBody("");
    startTransition(async () => {
      try {
        await addAgentNote(agent.memberId, body);
        setNotes((prev) => [{ id: crypto.randomUUID(), body, createdAt: new Date().toISOString() }, ...prev]);
        toast.success("Nota agregada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo agregar la nota.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader title="Información" />
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-neutral-500">Email</dt>
            <dd className="text-foreground">{agent.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Estado</dt>
            <dd>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Equipo</dt>
            <dd className="text-foreground">{agent.teamName ?? "Sin equipo"}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Supervisor</dt>
            <dd className="text-foreground">{agent.supervisorName ?? "Sin supervisor"}</dd>
          </div>
          <div>
            <dt className="text-xs text-neutral-500">Fecha de ingreso</dt>
            <dd className="text-foreground">
              {agent.hireDate ? new Date(agent.hireDate).toLocaleDateString("es") : "Sin datos"}
            </dd>
          </div>
        </dl>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Card>
          <span className="font-mono text-3xl font-semibold" style={{ color: scoreColor(agent.score) }}>
            {agent.score}
          </span>
          <p className="mt-1 text-[13px] text-neutral-500">Score general</p>
        </Card>
        <Card>
          <span className="font-mono text-2xl font-semibold text-foreground">{agent.leadsAssigned}</span>
          <p className="mt-1 text-[13px] text-neutral-500">Leads asignados</p>
        </Card>
        <Card>
          <span className="font-mono text-2xl font-semibold text-foreground">{agent.responseRate}%</span>
          <p className="mt-1 text-[13px] text-neutral-500">Tasa de respuesta</p>
        </Card>
        <Card>
          <span className="font-mono text-2xl font-semibold text-foreground">
            {agent.meetingsCompleted}/{agent.meetingsScheduled}
          </span>
          <p className="mt-1 text-[13px] text-neutral-500">Reuniones realizadas</p>
        </Card>
        <Card>
          <span className="font-mono text-2xl font-semibold text-foreground">{agent.conversionRate}%</span>
          <p className="mt-1 text-[13px] text-neutral-500">Conversión</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Actividad diaria (14 días)" />
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={agent.daily}>
                <CartesianGrid vertical={false} stroke="var(--border-default)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-neutral-500)" }} minTickGap={20} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-neutral-500)" }} width={24} allowDecimals={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="messages" name="Mensajes" stroke="var(--color-accent-500)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Reuniones semanales (8 semanas)" />
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agent.weekly}>
                <CartesianGrid vertical={false} stroke="var(--border-default)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-neutral-500)" }} minTickGap={20} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-neutral-500)" }} width={24} allowDecimals={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="meetings" name="Reuniones" fill="var(--color-accent-500)" radius={[4, 4, 4, 4]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Conversión mensual (6 meses)" />
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agent.monthly}>
                <CartesianGrid vertical={false} stroke="var(--border-default)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-neutral-500)" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "var(--color-neutral-500)" }} width={24} allowDecimals={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Bar dataKey="won" name="Ganadas" fill="var(--color-success)" radius={[4, 4, 4, 4]} maxBarSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Actividad reciente" />
          {agent.activity.length === 0 ? (
            <p className="text-sm text-neutral-500">Sin actividad reciente.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {agent.activity.map((event) => {
                const Icon = ACTIVITY_ICON[event.type] ?? MessageSquare;
                return (
                  <li key={event.id} className="flex items-start gap-3">
                    <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-neutral-500">
                      <Icon size={14} aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">{event.label}</p>
                      <p className="text-xs text-neutral-500">{formatDate(event.createdAt)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-xs text-neutral-400">
            Armado a partir de conversaciones/reuniones/oportunidades existentes — no es un registro de auditoría real.
          </p>
        </Card>

        <Card>
          <CardHeader title="Notas internas" />
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                placeholder="Ej. Excelente desempeño esta semana…"
                className="flex-1 rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
              />
              <Button size="sm" onClick={handleAddNote} loading={isPending}>
                Agregar
              </Button>
            </div>
            {notes.length === 0 ? (
              <p className="text-sm text-neutral-500">Sin notas todavía.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {notes.map((note) => (
                  <li key={note.id} className="rounded-md bg-surface-2 p-3">
                    <p className="text-sm text-foreground">{note.body}</p>
                    <p className="mt-1 text-xs text-neutral-500">{formatDate(note.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
