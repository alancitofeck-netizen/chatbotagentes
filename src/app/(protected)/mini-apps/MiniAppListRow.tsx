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

/** Fila compacta para la vista "lista" del toggle grilla/lista — mismos
 * datos y acciones que MiniAppCard.tsx, layout horizontal en vez de tarjeta. */
export function MiniAppListRow({ app, onDeleted, canManage }: { app: MiniAppListItem; onDeleted: () => void; canManage: boolean }) {
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
    <div className="flex items-center gap-3 rounded-xl border border-border-default bg-surface-2 p-3 transition-colors hover:bg-surface-3">
      <button
        type="button"
        data-tour="mini-apps.open-item"
        onClick={() => router.push(`/mini-apps/${app.id}`)}
        disabled={isPending}
        className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:opacity-60"
      >
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${visual.tintBg} ${visual.tintText}`}>
          <Icon className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {app.isPrivate && <span title="Mini App privada">🔒</span>}
            <h3 className="truncate text-[14px] font-semibold text-foreground">{app.name}</h3>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                app.status === "active" ? "bg-success-strong/15 text-success-strong" : "bg-surface-3 text-neutral-500"
              }`}
            >
              {app.status === "active" ? "Activa" : "Inactiva"}
            </span>
          </div>
          <p className="truncate text-[12px] text-neutral-500">{TEMPLATE_KEY_META[app.templateKey]?.label ?? app.templateKey}</p>
        </div>
        <div className="hidden shrink-0 items-center gap-4 text-[13px] text-neutral-500 sm:flex">
          <span className="flex items-center gap-1.5">
            <UserRound className="size-3.5" aria-hidden="true" />
            {app.assignedAgentName ?? "Sin asesor"}
          </span>
          <span className="flex items-center gap-1.5">
            <Users2 className="size-3.5" aria-hidden="true" />
            {app.leadsCount}
          </span>
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {formatDate(app.createdAt)}
          </span>
        </div>
      </button>

      <DropdownMenu
        trigger={<MoreVertical size={16} aria-hidden="true" />}
        triggerLabel="Más opciones"
        triggerClassName="flex size-7 shrink-0 items-center justify-center rounded-full text-neutral-400 hover:bg-surface-3 hover:text-foreground"
        items={[
          { label: "Abrir", icon: <Eye size={14} aria-hidden="true" />, onSelect: () => router.push(`/mini-apps/${app.id}`) },
          { label: "Ver leads", icon: <Users2 size={14} aria-hidden="true" />, onSelect: () => router.push(`/mini-apps/${app.id}?tab=leads`) },
          ...(canManage ? [{ label: "Eliminar", icon: <Trash2 size={14} aria-hidden="true" />, destructive: true, onSelect: handleDelete }] : []),
        ]}
      />
    </div>
  );
}
