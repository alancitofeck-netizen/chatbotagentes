"use client";

import { useEffect, useState, useTransition } from "react";
import { Users, X, Lock } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { toast } from "@/components/toast/toast";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { getMiniAppAccessList, grantMiniAppAccessAction, revokeMiniAppAccessAction, type MiniAppAccessRow } from "@/lib/miniApps/access";

/** Clon del bloque "Compartido con" de DocumentDetailDrawer.tsx
 * (document_permissions) adaptado a mini_app_access — misma interacción
 * (lista + selects de miembro/rol + agregar/quitar), pero acá SÍ controla
 * visibilidad real (vía la RLS de mini_apps), no solo metadata. */
export function AccesoTab({ miniAppId, members }: { miniAppId: string; members: WorkspaceMemberOption[] }) {
  const [access, setAccess] = useState<MiniAppAccessRow[] | null>(null);
  const [addMemberId, setAddMemberId] = useState("");
  const [addRole, setAddRole] = useState<"viewer" | "editor">("viewer");
  const [isPending, startTransition] = useTransition();

  function refetch() {
    getMiniAppAccessList(miniAppId).then(setAccess);
  }

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miniAppId]);

  const availableMembers = members.filter((m) => !(access ?? []).some((a) => a.memberId === m.memberId));

  function handleGrant() {
    if (!addMemberId) return;
    startTransition(async () => {
      try {
        await grantMiniAppAccessAction(miniAppId, addMemberId, addRole);
        setAddMemberId("");
        toast.success("Acceso otorgado.");
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo otorgar el acceso.");
      }
    });
  }

  function handleRevoke(memberId: string) {
    startTransition(async () => {
      try {
        await revokeMiniAppAccessAction(miniAppId, memberId);
        toast.success("Acceso quitado.");
        refetch();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo quitar el acceso.");
      }
    });
  }

  return (
    <Card className="flex max-w-xl flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-full bg-accent-100 text-accent-700">
          <Lock className="size-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-medium text-foreground">Gestionar acceso</p>
          <p className="text-xs text-neutral-500">Mini App privada — solo las personas de esta lista (y Owner/Admin) pueden verla o abrirla.</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <Users className="size-3.5" aria-hidden="true" /> Usuarios con acceso
        </p>
        {access === null ? (
          <p className="text-sm text-neutral-500">Cargando…</p>
        ) : access.length === 0 ? (
          <p className="text-[13px] text-neutral-500">Todavía nadie tiene acceso explícito — solo Owner/Admin pueden verla.</p>
        ) : (
          access.map((a) => (
            <div key={a.memberId} className="flex items-center justify-between gap-2 rounded-md bg-surface-2 px-2.5 py-1.5">
              <div className="flex items-center gap-2 text-[13px]">
                <Avatar name={a.fullName} src={a.avatarUrl} size={20} />
                {a.fullName}
                <span className="text-[11px] text-neutral-400">{a.role === "editor" ? "Editor" : "Solo lectura"}</span>
              </div>
              <button type="button" onClick={() => handleRevoke(a.memberId)} disabled={isPending} className="text-neutral-400 hover:text-error-strong">
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ))
        )}
      </div>

      {availableMembers.length > 0 && (
        <div className="flex gap-2">
          <Select label="" value={addMemberId} onChange={(e) => setAddMemberId(e.target.value)} containerClassName="flex-1">
            <option value="">Agregar persona…</option>
            {availableMembers.map((m) => (
              <option key={m.memberId} value={m.memberId}>
                {m.fullName}
              </option>
            ))}
          </Select>
          <Select label="" value={addRole} onChange={(e) => setAddRole(e.target.value as "viewer" | "editor")} containerClassName="w-32">
            <option value="viewer">Lectura</option>
            <option value="editor">Editor</option>
          </Select>
          <Button size="sm" onClick={handleGrant} disabled={!addMemberId || isPending}>
            Agregar
          </Button>
        </div>
      )}
    </Card>
  );
}
