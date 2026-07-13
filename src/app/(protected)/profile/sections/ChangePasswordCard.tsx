"use client";

import { useState, useTransition } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { changeMyPassword } from "@/lib/profile/actions";

/** Shared by AccountSection and SecuritySection (same component instance
 * rendered in both tabs, not duplicated logic) — the user's own spec listed
 * "Cambiar contraseña" under both Cuenta and Seguridad. */
export function ChangePasswordCard() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error("Las contraseñas no coinciden.");
      return;
    }
    startTransition(async () => {
      try {
        await changeMyPassword(newPassword);
        setNewPassword("");
        setConfirmPassword("");
        toast.success("Contraseña actualizada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo cambiar la contraseña.");
      }
    });
  }

  return (
    <Card>
      <CardHeader title="Cambiar contraseña" />
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <PasswordInput
          label="Nueva contraseña"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          hint="Mínimo 8 caracteres."
          required
          minLength={8}
        />
        <PasswordInput
          label="Confirmar contraseña"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
        />
        <Button type="submit" loading={isPending} className="self-start">
          Actualizar contraseña
        </Button>
      </form>
    </Card>
  );
}
