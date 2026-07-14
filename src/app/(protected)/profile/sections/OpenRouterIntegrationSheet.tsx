"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { OpenRouterIntegration } from "@/lib/integrations/queries";
import { saveOpenRouterIntegration } from "@/lib/integrations/actions";

/** Mirrors WhatsAppIntegrationSheet.tsx exactly — same conditional-mount
 * convention, same blank-means-keep-existing-key semantics. No "número"
 * field: OpenRouter has one key per workspace, not a per-number identity. */
export function OpenRouterIntegrationSheet({
  onClose,
  current,
  onSaved,
}: {
  onClose: () => void;
  current: OpenRouterIntegration | null;
  onSaved: () => void;
}) {
  const [displayName, setDisplayName] = useState(current?.displayName ?? "");
  const [apiKey, setApiKey] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await saveOpenRouterIntegration({ displayName, apiKey });
        toast.success("Integración de OpenRouter guardada.");
        onSaved();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar la integración.");
      }
    });
  }

  return (
    <Sheet open onClose={onClose} title="OpenRouter">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        <Input
          label="Nombre para mostrar"
          placeholder="Cuenta de OpenRouter"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          hint="Opcional, solo para identificarla en esta lista."
        />
        <PasswordInput
          label="OpenRouter API Key"
          placeholder={current?.hasCredentials ? "•••••••••••• (dejar en blanco para no cambiarla)" : "sk-or-..."}
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
