"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Trash2, Users2, UserRound, CalendarDays, Eye } from "lucide-react";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { toast } from "@/components/toast/toast";
import type { MiniAppListItem } from "@/lib/miniApps/queries";
import { TEMPLATE_KEY_META } from "@/lib/miniApps/templateCatalog";
import { deleteMiniApp } from "@/lib/miniApps/actions";
import { miniAppVisual } from "./miniAppVisuals";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

/** Tarjeta grilla del listado de Mini Apps — mismo patrón "card-como-botón +
 * menú posicionado encima" que ya usa DocumentsGrid.tsx (el trigger de
 * DropdownMenu ya hace stopPropagation, así que anidarlo dentro del botón
 * que abre la app no dispara los dos handlers a la vez). */
export function MiniAppCard({ app, onDeleted }: { app: MiniAppListItem; onDeleted: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const visual = miniAppVisual(app);
  const Icon = visual.icon;

  function handleDelete() {
    if (!window.confirm(`¿Eliminar "${app.name}"? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      try {
        await deleteMiniApp(app.id);
        toast.success("Mini app eliminada.");
        onDeleted();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
      }
    });
  }

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border-default bg-surface-2 transition-colors hover:bg-surface-3">
      <button
        type="button"
        onClick={() => router.push(`/mini-apps/${app.id}`)}
        disabled={isPending}
        className="flex flex-1 flex-col gap-3 p-4 text-left disabled:opacity-60"
      >
        <div className="flex items-start justify-between gap-2 pr-6">
          <div className="flex items-start gap-3">
            <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${visual.tintBg} ${visual.tintText}`}>
              <Icon className="size-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3 className="text-[15px] font-semibold text-foreground">{app.name}</h3>
              <p className="mt-0.5 text-[11px] font-medium tracking-wide text-neutral-400 uppercase">
                {TEMPLATE_KEY_META[app.templateKey]?.label ?? app.templateKey}
              </p>
            </div>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
              app.status === "active" ? "bg-success-strong/15 text-success-strong" : "bg-surface-3 text-neutral-500"
            }`}
          >
            {app.status === "active" ? "Activa" : "Inactiva"}
          </span>
        </div>

        <p className="flex items-center gap-1.5 text-[13px] text-neutral-500">
          <UserRound className="size-3.5" aria-hidden="true" />
          {app.assignedAgentName ?? "Sin asesor asignado"}
        </p>

        <div className="mt-auto flex items-center justify-between text-[13px] text-neutral-500">
          <span className="flex items-center gap-1.5">
            <Users2 className="size-3.5" aria-hidden="true" />
            {app.leadsCount} lead{app.leadsCount === 1 ? "" : "s"}
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {formatDate(app.createdAt)}
          </span>
        </div>
      </button>

      <div className="absolute top-3 right-3">
        <DropdownMenu
          trigger={<MoreVertical size={16} aria-hidden="true" />}
          triggerLabel="Más opciones"
          triggerClassName="flex size-7 items-center justify-center rounded-full text-neutral-400 hover:bg-surface-3 hover:text-foreground"
          items={[
            { label: "Abrir", icon: <Eye size={14} aria-hidden="true" />, onSelect: () => router.push(`/mini-apps/${app.id}`) },
            { label: "Ver leads", icon: <Users2 size={14} aria-hidden="true" />, onSelect: () => router.push(`/mini-apps/${app.id}?tab=leads`) },
            { label: "Eliminar", icon: <Trash2 size={14} aria-hidden="true" />, destructive: true, onSelect: handleDelete },
          ]}
        />
      </div>

      <div className={`h-1 w-full ${visual.bar}`} aria-hidden="true" />
    </div>
  );
}
