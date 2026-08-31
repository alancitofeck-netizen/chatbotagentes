"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { Camera } from "lucide-react";
import type { ManychatLeadListItem } from "@/lib/integrations/manychat";

const LEVEL_LABEL: Record<string, string> = { none: "Sin interacción", low: "Baja", medium: "Media", high: "Alta" };
const LEVEL_VARIANT: Record<string, "neutral" | "warning" | "info" | "success"> = { none: "neutral", low: "warning", medium: "info", high: "success" };

const FILTER_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "reel", label: "Reels" },
  { value: "story", label: "Stories" },
  { value: "dm", label: "DM" },
  { value: "comment", label: "Comentarios" },
  { value: "high", label: "Interacción alta" },
  { value: "medium", label: "Interacción media" },
  { value: "low", label: "Interacción baja" },
  { value: "nuevo", label: "Nuevos" },
  { value: "con_telefono", label: "Con teléfono" },
  { value: "con_email", label: "Con email" },
  { value: "recientes", label: "Conversaciones recientes (7 días)" },
];

const SORT_OPTIONS = [
  { value: "score", label: "Mayor interaction score" },
  { value: "mensajes", label: "Mayor cantidad de mensajes" },
  { value: "reciente", label: "Última interacción" },
  { value: "creacion", label: "Fecha de captación" },
];

function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return `Hoy · ${date.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Ayer";
  return date.toLocaleDateString("es", { day: "2-digit", month: "short" });
}

/** ManyChat → Leads — todo filtrado/orden es client-side sobre lo ya
 * cargado server-side (mismo criterio que AiAgentsSection.tsx). */
export function LeadsTab({
  connected,
  leads,
  onSelectLead,
  onGoToConfig,
}: {
  connected: boolean;
  leads: ManychatLeadListItem[];
  onSelectLead: (contactId: string) => void;
  onGoToConfig: () => void;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("todos");
  const [sort, setSort] = useState("score");
  const [nowMs] = useState(() => Date.now());

  const filtered = useMemo(() => {
    const sevenDaysAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
    const q = search.trim().toLowerCase();
    let rows = leads.filter((l) => {
      if (q && !l.name.toLowerCase().includes(q) && !(l.instagramUsername ?? "").toLowerCase().includes(q) && !(l.phone ?? "").includes(q) && !(l.email ?? "").toLowerCase().includes(q))
        return false;
      if (filter === "high" || filter === "medium" || filter === "low") return l.interactionLevel === filter;
      if (filter === "reel" || filter === "story" || filter === "dm" || filter === "comment") return l.source === filter;
      if (filter === "nuevo") return l.leadStatus === "nuevo";
      if (filter === "con_telefono") return Boolean(l.phone);
      if (filter === "con_email") return Boolean(l.email);
      if (filter === "recientes") return new Date(l.lastInteractionAt).getTime() >= sevenDaysAgo;
      return true;
    });

    rows = [...rows].sort((a, b) => {
      if (sort === "score") return b.interactionScore - a.interactionScore;
      if (sort === "mensajes") return b.totalMessageCount - a.totalMessageCount;
      if (sort === "creacion") return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return new Date(b.lastInteractionAt).getTime() - new Date(a.lastInteractionAt).getTime();
    });
    return rows;
  }, [leads, search, filter, sort, nowMs]);

  if (!connected) {
    return (
      <EmptyState
        icon={Camera}
        title="ManyChat todavía no está conectado"
        description="Conectá tu cuenta desde Configuración para empezar a ver los leads reales de Instagram acá."
        action={<Button onClick={onGoToConfig}>Ir a Configuración</Button>}
      />
    );
  }

  if (leads.length === 0) {
    return (
      <EmptyState
        icon={Camera}
        title="Todavía no llegó ningún lead"
        description="En cuanto tu flujo de ManyChat mande el primer evento (paso External Request), va a aparecer acá."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <Input label="Buscar lead" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nombre, @usuario, teléfono o email..." />
          </div>
          <Select label="Filtro" value={filter} onChange={(e) => setFilter(e.target.value)} containerClassName="w-56">
            {FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select label="Ordenar por" value={sort} onChange={(e) => setSort(e.target.value)} containerClassName="w-48">
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <div className="overflow-x-auto rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-sm)]">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead>
            <tr className="border-b border-border-default text-xs uppercase text-neutral-500">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Fuente</th>
              <th className="px-4 py-3 font-medium">Último contacto</th>
              <th className="px-4 py-3 font-medium">Mensajes</th>
              <th className="px-4 py-3 font-medium">Interacción</th>
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.contactId} className="cursor-pointer border-b border-border-default last:border-b-0 hover:bg-surface-2" onClick={() => onSelectLead(l.contactId)}>
                <td className="px-4 py-3">
                  <p className="truncate text-sm font-medium text-foreground">{l.name}</p>
                  {l.instagramUsername && <p className="truncate text-xs text-neutral-500">@{l.instagramUsername}</p>}
                </td>
                <td className="px-4 py-3">
                  {l.source ? (
                    <div>
                      <Badge variant="accent" className="capitalize">
                        {l.source}
                      </Badge>
                      {l.contentName && <p className="mt-1 max-w-[160px] truncate text-xs text-neutral-500">{l.contentName}</p>}
                    </div>
                  ) : (
                    <span className="text-xs text-neutral-400">Sin especificar</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-neutral-500">{formatRelativeDate(l.lastInteractionAt)}</td>
                <td className="px-4 py-3 font-mono text-xs text-neutral-600">{l.totalMessageCount}</td>
                <td className="px-4 py-3">
                  <Badge variant={LEVEL_VARIANT[l.interactionLevel]}>{LEVEL_LABEL[l.interactionLevel]}</Badge>
                </td>
                <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{l.interactionScore}</td>
                <td className="px-4 py-3 text-xs capitalize text-neutral-600">{l.leadStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="p-6 text-center text-sm text-neutral-500">Ningún lead coincide con los filtros.</p>}
      </div>
    </div>
  );
}
