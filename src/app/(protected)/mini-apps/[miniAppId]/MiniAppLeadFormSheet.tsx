"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { createMiniAppLeadManualAction } from "@/lib/miniApps/actions";

/** "Agregar lead manual" — para cuando un lead llega por fuera de la mini app
 * (una llamada, una recomendación) y el asesor lo quiere cargar a mano en la
 * misma bandeja. No existía ningún camino para esto antes (ver
 * createMiniAppLeadManualAction). */
export function MiniAppLeadFormSheet({
  miniAppId,
  members,
  onClose,
  onSaved,
}: {
  miniAppId: string;
  members: WorkspaceMemberOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [agente, setAgente] = useState("");
  const [contenido, setContenido] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!nombre.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    if (!whatsapp.trim()) {
      toast.error("El WhatsApp es obligatorio.");
      return;
    }
    startTransition(async () => {
      try {
        await createMiniAppLeadManualAction(miniAppId, { nombre, whatsapp, agente: agente || null, contenido });
        toast.success("Lead agregado.");
        onSaved();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo agregar el lead.");
      }
    });
  }

  return (
    <Sheet open onClose={onClose} title="Agregar lead">
      <div className="flex flex-col gap-4 p-5">
        <Input label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <Input label="WhatsApp" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="521…" />
        <Select label="Agente" value={agente} onChange={(e) => setAgente(e.target.value)}>
          <option value="">Sin asignar</option>
          {members.map((m) => (
            <option key={m.memberId} value={m.fullName}>
              {m.fullName}
            </option>
          ))}
        </Select>
        <Input label="Nota (opcional)" value={contenido} onChange={(e) => setContenido(e.target.value)} placeholder="Cómo llegó, qué le interesa…" />
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} loading={isPending}>
            Guardar
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
