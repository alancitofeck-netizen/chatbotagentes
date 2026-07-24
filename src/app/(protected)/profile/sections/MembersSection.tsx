"use client";

import { useState, useTransition } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { WorkspaceMember } from "@/lib/settings/queries";
import { removeMember, updateMemberRole } from "@/lib/settings/actions";
import { InviteMemberSheet } from "./InviteMemberSheet";

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "agent", label: "Agente" },
];

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  agent: "Agente",
};

export function MembersSection({
  members,
  canManage,
  ownMemberId,
  onChanged,
}: {
  members: WorkspaceMember[];
  canManage: boolean;
  ownMemberId: string | null;
  onChanged: () => void;
}) {
  const [inviteOpen, setInviteOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleRoleChange(memberId: string, role: string) {
    startTransition(async () => {
      try {
        await updateMemberRole(memberId, role as "owner" | "admin" | "agent");
        onChanged();
        toast.success("Rol actualizado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar el rol.");
      }
    });
  }

  function handleRemove(member: WorkspaceMember) {
    if (!window.confirm(`¿Quitar a "${member.fullName}" de este workspace?`)) return;
    startTransition(async () => {
      try {
        await removeMember(member.memberId);
        onChanged();
        toast.success("Miembro eliminado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo eliminar al miembro.");
      }
    });
  }

  return (
    <Card>
      <CardHeader
        title="Miembros"
        action={
          canManage && (
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus size={15} aria-hidden="true" />
              Invitar miembro
            </Button>
          )
        }
      />
      <ul className="flex flex-col divide-y divide-border-default">
        {members.map((m) => (
          <li key={m.memberId} className="flex items-center gap-3 py-3">
            <Avatar name={m.fullName} size={32} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{m.fullName}</p>
              <p className="truncate text-[13px] text-neutral-500">{m.email}</p>
            </div>
            {canManage && m.memberId !== ownMemberId ? (
              <Select
                label="Rol"
                containerClassName="w-40"
                value={m.role}
                disabled={isPending}
                onChange={(e) => handleRoleChange(m.memberId, e.target.value)}
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            ) : (
              <Badge variant="neutral">{ROLE_LABEL[m.role] ?? m.role}</Badge>
            )}
            {canManage && (
              <button
                type="button"
                aria-label="Quitar miembro"
                disabled={isPending}
                onClick={() => handleRemove(m)}
                className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong disabled:opacity-50"
              >
                <Trash2 size={15} aria-hidden="true" />
              </button>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <InviteMemberSheet open={inviteOpen} onClose={() => setInviteOpen(false)} onInvited={onChanged} />
      )}
    </Card>
  );
}
