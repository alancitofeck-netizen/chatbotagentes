"use client";

import { useState, useTransition } from "react";
import { Check, Copy } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { createMiniApp } from "@/lib/miniApps/actions";

const TEMPLATES = [
  { key: "simulador_retiro", label: "Simulador de Retiro", available: true },
  { key: "calculadora", label: "Calculadora (Próximamente)", available: false },
  { key: "formulario", label: "Formulario (Próximamente)", available: false },
  { key: "landing", label: "Landing (Próximamente)", available: false },
  { key: "personalizado", label: "Personalizado (Próximamente)", available: false },
] as const;

function CopyableField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</span>
      <div className="flex items-center gap-2 rounded-md border border-border-default bg-surface-2 px-3 py-2">
        <code className="flex-1 truncate text-[13px] text-foreground">{value}</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 text-neutral-500 hover:text-foreground"
        >
          {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

export function NewMiniAppSheet({
  members,
  onClose,
  onCreated,
}: {
  members: WorkspaceMemberOption[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [assignedAgentId, setAssignedAgentId] = useState("");
  const [allowedOrigins, setAllowedOrigins] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [isPending, startTransition] = useTransition();
  const [created, setCreated] = useState<{ slug: string; apiKey: string } | null>(null);

  function handleCreate() {
    if (!name.trim()) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createMiniApp({
          name,
          description,
          templateKey: "simulador_retiro",
          assignedAgentId: assignedAgentId || null,
          allowedOrigins: allowedOrigins
            .split(/[\n,]/)
            .map((o) => o.trim())
            .filter(Boolean),
          externalUrl,
        });
        setCreated(result);
        onCreated();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear la mini app.");
      }
    });
  }

  if (created) {
    const endpointUrl = `${window.location.origin}/api/public/mini-apps/${created.slug}/leads`;
    return (
      <Sheet open onClose={onClose} title="Mini App creada">
        <div className="flex flex-col gap-4 p-5">
          <p className="text-sm text-neutral-500">
            Guardá esta API key ahora — no se va a poder ver de nuevo. Pasale estos 2 datos al desarrollador de la mini app.
          </p>
          <CopyableField label="Endpoint" value={endpointUrl} />
          <CopyableField label="API Key" value={created.apiKey} />
          <Button onClick={onClose}>Listo</Button>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet open onClose={onClose} title="Nueva Mini App">
      <div className="flex flex-col gap-4 p-5">
        <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Simulador de Retiro — Diego Tinoco" />
        <Input label="Descripción" value={description} onChange={(e) => setDescription(e.target.value)} />
        <Select label="Plantilla" value="simulador_retiro" onChange={() => {}} disabled>
          {TEMPLATES.map((t) => (
            <option key={t.key} value={t.key} disabled={!t.available}>
              {t.label}
            </option>
          ))}
        </Select>
        <Select label="Agente asignado" value={assignedAgentId} onChange={(e) => setAssignedAgentId(e.target.value)}>
          <option value="">Sin asignar</option>
          {members.map((m) => (
            <option key={m.memberId} value={m.memberId}>
              {m.fullName}
            </option>
          ))}
        </Select>
        <Input
          label="URL donde vive la mini app (opcional)"
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          placeholder="https://simulador-retiro.ejemplo.com"
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Dominios permitidos (CORS)</label>
          <textarea
            value={allowedOrigins}
            onChange={(e) => setAllowedOrigins(e.target.value)}
            placeholder={"https://simulador-retiro.ejemplo.com\nUn dominio por línea"}
            rows={3}
            className="rounded-md border border-border-default bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
          />
          <p className="text-xs text-neutral-500">El dominio exacto (con https://) desde donde la mini app va a mandar los leads.</p>
        </div>

        <Button onClick={handleCreate} loading={isPending}>
          Crear Mini App
        </Button>
      </div>
    </Sheet>
  );
}
