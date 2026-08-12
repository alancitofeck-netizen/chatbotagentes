"use client";

import { useMemo, useState, useTransition } from "react";
import { Link2, CheckCircle2, CalendarClock, AlertTriangle, Plus, MoreVertical, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { MetricCard } from "@/components/responseSummary/MetricCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/toast/toast";
import type { ClientAccess } from "@/lib/clients/queries";
import { getClientAccessListAction, deleteClientAccessAction } from "@/lib/clients/actions";
import { AddClientAccessSheet } from "./AddClientAccessSheet";

type Urgency = "active" | "expiring" | "expired" | "inactive";

function urgencyOf(a: ClientAccess): Urgency {
  if (a.status === "inactive") return "inactive";
  if (!a.expiresAt) return "active";
  const days = Math.ceil((new Date(a.expiresAt).getTime() - new Date().setHours(0, 0, 0, 0)) / 86400000);
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "active";
}

const URGENCY_META: Record<Urgency, { label: string; variant: "success" | "warning" | "error" | "neutral" }> = {
  active: { label: "Activo", variant: "success" },
  expiring: { label: "Por vencer", variant: "warning" },
  expired: { label: "Vencido", variant: "error" },
  inactive: { label: "Inactivo", variant: "neutral" },
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

export function ClientAccessPanel({
  clientId,
  initialAccess,
  shared,
}: {
  clientId: string;
  initialAccess: ClientAccess[];
  shared: { role: string; name: string | undefined }[];
}) {
  const [access, setAccess] = useState(initialAccess);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ClientAccess | null>(null);
  const [, startTransition] = useTransition();

  async function refetch() {
    setAccess(await getClientAccessListAction(clientId));
  }

  const metrics = useMemo(() => {
    const withUrgency = access.map((a) => ({ a, urgency: urgencyOf(a) }));
    return {
      total: access.length,
      active: withUrgency.filter((x) => x.urgency === "active" || x.urgency === "expiring").length,
      expiring: withUrgency.filter((x) => x.urgency === "expiring").length,
      expired: withUrgency.filter((x) => x.urgency === "expired").length,
    };
  }, [access]);

  function handleDelete(id: string) {
    if (!window.confirm("¿Eliminar este acceso?")) return;
    startTransition(async () => {
      try {
        await deleteClientAccessAction(id, clientId);
        toast.success("Acceso eliminado.");
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard icon={Link2} label="Cuentas conectadas" value={String(metrics.total)} />
        <MetricCard icon={CheckCircle2} label="Activas" value={String(metrics.active)} />
        <MetricCard icon={CalendarClock} label="Por vencer" value={String(metrics.expiring)} />
        <MetricCard icon={AlertTriangle} label="Vencidas" value={String(metrics.expired)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        <Card>
          <div className="flex items-center justify-between pb-3">
            <CardHeader title="Accesos y plataformas" />
            <Button size="sm" onClick={() => setCreating(true)}>
              <Plus className="size-4" aria-hidden="true" />
              Agregar acceso
            </Button>
          </div>

          {access.length === 0 ? (
            <EmptyState icon={Link2} title="Sin accesos cargados" description="Agregá las plataformas y cuentas que usa este cliente." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-border-default text-xs text-neutral-500">
                    <th className="py-2 font-medium">Plataforma / Servicio</th>
                    <th className="py-2 font-medium">Usuario / Cuenta</th>
                    <th className="py-2 font-medium">Permiso</th>
                    <th className="py-2 font-medium">Vencimiento</th>
                    <th className="py-2 font-medium">Estado</th>
                    <th className="py-2 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {access.map((a) => {
                    const urgency = URGENCY_META[urgencyOf(a)];
                    return (
                      <tr key={a.id} className="border-b border-border-default last:border-0">
                        <td className="py-2 font-medium text-foreground">{a.platform}</td>
                        <td className="py-2 text-neutral-500">{a.accountLabel}</td>
                        <td className="py-2 text-neutral-500">{a.permission ?? "—"}</td>
                        <td className="py-2 text-neutral-500">{formatDate(a.expiresAt)}</td>
                        <td className="py-2">
                          <Badge variant={urgency.variant}>{urgency.label}</Badge>
                        </td>
                        <td className="py-2">
                          <DropdownMenu
                            trigger={<MoreVertical size={16} aria-hidden="true" />}
                            triggerLabel="Más opciones"
                            triggerClassName="flex size-7 items-center justify-center rounded-full text-neutral-400 hover:bg-surface-3 hover:text-foreground"
                            items={[
                              { label: "Editar", icon: <Pencil size={14} aria-hidden="true" />, onSelect: () => setEditing(a) },
                              { label: "Eliminar", icon: <Trash2 size={14} aria-hidden="true" />, destructive: true, onSelect: () => handleDelete(a.id) },
                            ]}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Seguridad" />
            <div className="flex items-center gap-2.5 rounded-md bg-surface-2 p-3 text-sm text-neutral-500">
              <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
              No disponible para este cliente — no existe hoy 2FA ni tracking de dispositivos a nivel de cliente externo.
            </div>
          </Card>

          <Card>
            <CardHeader title="Compartidos con" />
            {shared.length === 0 ? (
              <p className="text-sm text-neutral-500">Sin Setter/Traffic Manager/Account Manager asignado.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {shared.map((s) => (
                  <li key={s.role} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{s.name ?? "—"}</span>
                    <Badge variant="neutral">{s.role}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {(creating || editing) && (
        <AddClientAccessSheet
          clientId={clientId}
          access={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={refetch}
        />
      )}
    </div>
  );
}
