"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { ClientProfile } from "@/lib/clients/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { EditClientSheet } from "./EditClientSheet";

export function ClientHeaderActions({ client, members }: { client: ClientProfile; members: WorkspaceMemberOption[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  return (
    <>
      <Button variant="secondary" onClick={() => setEditing(true)}>
        <Pencil className="size-3.5" aria-hidden="true" />
        Editar cliente
      </Button>
      {editing && <EditClientSheet client={client} members={members} onClose={() => setEditing(false)} onSaved={() => router.refresh()} />}
    </>
  );
}
