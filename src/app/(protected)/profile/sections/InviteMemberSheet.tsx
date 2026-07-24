"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { inviteMember } from "@/lib/settings/actions";

const ROLE_OPTIONS = [
  { value: "agent", label: "Agente" },
  { value: "admin", label: "Admin" },
  { value: "owner", label: "Owner" },
];

export function InviteMemberSheet({
  open,
  onClose,
  onInvited,
}: {
  open: boolean;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("agent");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setEmail("");
    setRole("agent");
  }

  function handleInvite() {
    if (!email.trim()) {
      toast.error("El email es obligatorio.");
      return;
    }
    startTransition(async () => {
      try {
        await inviteMember(email, role as "owner" | "admin" | "agent");
        toast.success("Invitación enviada.");
        reset();
        onInvited();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo invitar a este email.");
      }
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Invitar miembro">
      <div className="flex flex-col gap-4 p-5">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="persona@empresa.com"
        />
        <Select label="Rol" value={role} onChange={(e) => setRole(e.target.value)}>
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <p className="text-xs text-neutral-500">
          Si el email ya tiene cuenta en Growth Link, se lo agrega directo (sin mandar email). Si es nuevo, se le
          envía una invitación por email — el envío de Supabase en este plan tiene un límite de volumen bajo.
        </p>
        <Button onClick={handleInvite} loading={isPending}>
          Invitar
        </Button>
      </div>
    </Sheet>
  );
}
