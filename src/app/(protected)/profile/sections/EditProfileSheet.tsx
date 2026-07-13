"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { MyProfile } from "@/lib/profile/queries";
import { updateMyProfile } from "@/lib/profile/actions";

/** Conditionally mounted by the parent — same convention as LeadFormSheet/
 * WhatsAppIntegrationSheet, state initialized directly from props, no
 * resync effect needed. Email/rol/workspace/fecha de alta are shown
 * read-only here (changing email requires Supabase's own re-verification
 * flow, and role/workspace/created_at aren't self-editable fields). */
export function EditProfileSheet({
  profile,
  onClose,
  onSaved,
}: {
  profile: MyProfile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(profile.fullName);
  const [username, setUsername] = useState(profile.username);
  const [phone, setPhone] = useState(profile.phone);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await updateMyProfile({ fullName, username, phone });
        toast.success("Perfil actualizado.");
        onSaved();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar el perfil.");
      }
    });
  }

  return (
    <Sheet open onClose={onClose} title="Editar perfil">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        <Input label="Nombre completo" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <Input
          label="Nombre de usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          hint="Solo visual — no reemplaza al email para iniciar sesión."
        />
        <Input label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+54 9 ..." />
        <Input label="Email" value={profile.email} disabled hint="Para cambiar el email, contactá a soporte." />
        <div className="mt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="submit" loading={isPending}>
            Guardar
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
