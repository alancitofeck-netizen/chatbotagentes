"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientProfile } from "@/lib/clients/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { EditClientSheet } from "../EditClientSheet";

/** "Editar" de las cards Calendly/LinkedIn de Resumen — mismo
 * EditClientSheet que el header (updateClientAction ya cubre estos
 * campos), evita una segunda mini-edición duplicada por campo. */
export function ResumenSideCardEdit({ client, members }: { client: ClientProfile; members: WorkspaceMemberOption[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-accent-600 hover:underline">
        Editar
      </button>
      {editing && <EditClientSheet client={client} members={members} onClose={() => setEditing(false)} onSaved={() => router.refresh()} />}
    </>
  );
}
