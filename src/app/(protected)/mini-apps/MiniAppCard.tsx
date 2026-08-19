"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Trash2, Users2, UserRound, CalendarDays, Eye, Link2 } from "lucide-react";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { toast } from "@/components/toast/toast";
import type { MiniAppListItem } from "@/lib/miniApps/queries";
import { TEMPLATE_KEY_META } from "@/lib/miniApps/templateCatalog";
import { deleteMiniApp } from "@/lib/miniApps/actions";
import { miniAppVisual } from "./miniAppVisuals";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

/** Tarjeta grilla del listado de Mini Apps — mismo lenguaje visual que la
 * grilla de plantillas del wizard (ícono grande en cuadrado con tinte,
 * título, descripción de 2 líneas, tarjeta blanca espaciosa) para que
 * "elegir tipo" y "ver mis mini apps" se sientan como la misma superficie.
 * A diferencia de las tarjetas de plantilla (sin datos propios), estas SÍ
 * representan una instancia real con leads/estado/asesor — esa info se
 * empuja a un pie liviano en vez de ocupar el bloque principal, así el
 * ícono+título+descripción queda igual de limpio que en el picker. Mismo
 * patrón "card-como-botón + menú posicionado encima" que ya usa
 * DocumentsGrid.tsx (el trigger de DropdownMenu ya hace stopPropagation,
 * así que anidarlo dentro del botón que abre la app no dispara los dos
 * handlers a la vez). */
export function MiniAppCard({ app, onDeleted, canManage }: { app: MiniAppListItem; onDeleted: () => void; canManage: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const visual = miniAppVisual(app);
  const Icon = visual.icon;

  function handleCopyLink(e: React.MouseEvent) {
    e.stopPropagation();
    const publicUrl = `${window.location.origin}/apps/${app.slug}`;
    navigator.clipboard.writeText(publicUrl);
    toast.success("Link copiado.");
  }

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
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-border-default bg-surface-1 transition-all hover:border-accent-300 hover:shadow-[var(--elevation-sm)]">
      <button
        type="button"
        onClick={() => router.push(`/mini-apps/${app.id}`)}
        disabled={isPending}
        className="flex flex-1 flex-col gap-4 p-5 text-left disabled:opacity-60"
      >
        <div className="flex items-start justify-between gap-2 pr-16">
          <div className={`flex size-12 shrink-0 items-center justify-center rounded-2xl ${visual.tintBg} ${visual.tintText}`}>
            <Icon className="size-6" aria-hidden="true" />
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
              app.status === "active" ? "bg-success-strong/15 text-success-strong" : "bg-surface-3 text-neutral-500"
            }`}
          >
            {app.status === "active" ? "Activa" : "Inactiva"}
          </span>
        </div>

        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold text-foreground">{app.name}</h3>
          <p className="mt-1 line-clamp-2 text-[13px] text-neutral-500">
            {app.description || `Plantilla: ${TEMPLATE_KEY_META[app.templateKey]?.label ?? app.templateKey}`}
          </p>
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-border-default pt-3 text-[12.5px] text-neutral-500">
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{app.assignedAgentName ?? "Sin asesor"}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <Users2 className="size-3.5" aria-hidden="true" />
            {app.leadsCount}
          </span>
          <span className="hidden shrink-0 items-center gap-1.5 sm:flex">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            {formatDate(app.createdAt)}
          </span>
        </div>
      </button>

      <div className="absolute top-4 right-4 flex items-center gap-1">
        <button
          type="button"
          onClick={handleCopyLink}
          title="Copiar link público"
          aria-label="Copiar link público"
          className="flex size-7 items-center justify-center rounded-full text-neutral-400 hover:bg-surface-3 hover:text-foreground"
        >
          <Link2 size={15} aria-hidden="true" />
        </button>
        <DropdownMenu
          trigger={<MoreVertical size={16} aria-hidden="true" />}
          triggerLabel="Más opciones"
          triggerClassName="flex size-7 items-center justify-center rounded-full text-neutral-400 hover:bg-surface-3 hover:text-foreground"
          items={[
            { label: "Abrir", icon: <Eye size={14} aria-hidden="true" />, onSelect: () => router.push(`/mini-apps/${app.id}`) },
            { label: "Ver leads", icon: <Users2 size={14} aria-hidden="true" />, onSelect: () => router.push(`/mini-apps/${app.id}?tab=leads`) },
            ...(canManage ? [{ label: "Eliminar", icon: <Trash2 size={14} aria-hidden="true" />, destructive: true, onSelect: handleDelete }] : []),
          ]}
        />
      </div>
    </div>
  );
}
