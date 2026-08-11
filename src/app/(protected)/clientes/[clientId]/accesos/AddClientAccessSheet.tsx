"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { ClientAccess } from "@/lib/clients/queries";
import { createClientAccessAction, updateClientAccessAction } from "@/lib/clients/actions";

export function AddClientAccessSheet({
  clientId,
  access,
  onClose,
  onSaved,
}: {
  clientId: string;
  access: ClientAccess | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = access !== null;
  const [platform, setPlatform] = useState(access?.platform ?? "");
  const [accountLabel, setAccountLabel] = useState(access?.accountLabel ?? "");
  const [permission, setPermission] = useState(access?.permission ?? "");
  const [expiresAt, setExpiresAt] = useState(access?.expiresAt ?? "");
  const [status, setStatus] = useState<"active" | "inactive">(access?.status ?? "active");
  const [notes, setNotes] = useState(access?.notes ?? "");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!platform.trim() || !accountLabel.trim()) {
      toast.error("Plataforma y usuario/cuenta son obligatorios.");
      return;
    }
    startTransition(async () => {
      try {
        const input = { platform, accountLabel, permission, expiresAt: expiresAt || null, notes };
        if (isEdit && access) {
          await updateClientAccessAction(access.id, clientId, { ...input, status });
        } else {
          await createClientAccessAction(clientId, input);
        }
        toast.success(isEdit ? "Acceso actualizado." : "Acceso agregado.");
        onSaved();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar el acceso.");
      }
    });
  }

  return (
    <Sheet open onClose={onClose} title={isEdit ? "Editar acceso" : "Agregar acceso"}>
      <div className="flex flex-col gap-4 p-5">
        <Input label="Plataforma / Servicio" value={platform} onChange={(e) => setPlatform(e.target.value)} placeholder="Ej. LinkedIn Sales Navigator" />
        <Input label="Usuario / Cuenta" value={accountLabel} onChange={(e) => setAccountLabel(e.target.value)} placeholder="Ej. patricio.jaik@empresa.com" />
        <Input label="Permiso (opcional)" value={permission} onChange={(e) => setPermission(e.target.value)} placeholder="Ej. Admin, Editor, Lector" />
        <Input label="Vencimiento (opcional)" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
        {isEdit && (
          <Select label="Estado" value={status} onChange={(e) => setStatus(e.target.value as "active" | "inactive")}>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo (revocado)</option>
          </Select>
        )}
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Notas (opcional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        </label>
        <Button onClick={handleSave} loading={isPending}>
          {isEdit ? "Guardar cambios" : "Agregar acceso"}
        </Button>
      </div>
    </Sheet>
  );
}
