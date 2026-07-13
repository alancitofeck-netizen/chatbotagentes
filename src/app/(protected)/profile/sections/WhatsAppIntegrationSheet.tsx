"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { WhatsAppIntegration } from "@/lib/integrations/queries";
import { saveWhatsAppIntegration } from "@/lib/integrations/actions";

/** Conditionally mounted by the parent (`{sheetOpen && <WhatsAppIntegrationSheet .../>}`,
 * same convention as LeadFormSheet/DealFormSheet) — so state can just be
 * initialized from `current` directly instead of resynced via an effect on
 * every open (which the `react-hooks/set-state-in-effect` lint rule flags). */
export function WhatsAppIntegrationSheet({
  onClose,
  current,
  onSaved,
}: {
  onClose: () => void;
  current: WhatsAppIntegration | null;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(current?.displayName ?? "");
  const [externalAccountId, setExternalAccountId] = useState(current?.externalAccountId ?? "");
  const [apiKey, setApiKey] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await saveWhatsAppIntegration({ displayName, externalAccountId, apiKey });
        toast.success("Integración de WhatsApp guardada.");
        onSaved();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar la integración.");
      }
    });
  }

  return (
    <Sheet open onClose={onClose} title="WhatsApp (YCloud)">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        <Input
          label="Nombre para mostrar"
          placeholder="WhatsApp Business — Ventas"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          hint="Opcional, solo para identificarla en esta lista."
        />
        <Input
          label="Número de WhatsApp Business"
          placeholder="+15551234567"
          value={externalAccountId}
          onChange={(e) => setExternalAccountId(e.target.value)}
          hint="El número asociado a tu cuenta YCloud, tal como aparece en su dashboard."
          required
        />
        <PasswordInput
          label="YCloud API Key"
          placeholder={current?.hasCredentials ? "•••••••••••• (dejar en blanco para no cambiarla)" : "API Key"}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          hint="Se guarda cifrada en Supabase Vault — no se vuelve a mostrar."
          required={!current?.hasCredentials}
        />
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
