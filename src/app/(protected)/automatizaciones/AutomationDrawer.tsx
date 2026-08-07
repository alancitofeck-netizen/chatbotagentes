"use client";

import { useRef, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Switch } from "@/components/ui/Switch";
import { toast } from "@/components/toast/toast";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { AUTOMATION_VARIABLES } from "@/lib/automationTemplates/constants";
import { updateAutomationAction } from "@/lib/automationTemplates/actions";
import { AUTOMATION_ICON_MAP } from "./icons";
import type { AutomationTemplate } from "@/lib/automationTemplates/queries";

export function AutomationDrawer({
  automation,
  open,
  onClose,
  onUpdated,
}: {
  automation: AutomationTemplate;
  open: boolean;
  onClose: () => void;
  onUpdated: (next: AutomationTemplate) => void;
}) {
  const Icon = AUTOMATION_ICON_MAP[automation.icon as keyof typeof AUTOMATION_ICON_MAP] ?? AUTOMATION_ICON_MAP.Sparkles;

  const [enabled, setEnabled] = useState(automation.enabled);
  const [whatsappEnabled, setWhatsappEnabled] = useState(automation.whatsappEnabled);
  const [emailEnabled, setEmailEnabled] = useState(automation.emailEnabled);
  const [message, setMessage] = useState(automation.messageTemplate);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertVariable(key: string) {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMessage((m) => `${m}{{${key}}}`);
      return;
    }
    const start = textarea.selectionStart ?? message.length;
    const end = textarea.selectionEnd ?? message.length;
    const next = `${message.slice(0, start)}{{${key}}}${message.slice(end)}`;
    setMessage(next);
    requestAnimationFrame(() => {
      textarea.focus();
      const cursor = start + key.length + 4;
      textarea.setSelectionRange(cursor, cursor);
    });
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      await updateAutomationAction(automation.key, { enabled, whatsappEnabled, emailEnabled, messageTemplate: message });
      onUpdated({ ...automation, enabled, whatsappEnabled, emailEnabled, messageTemplate: message });
      toast.success("Automatización actualizada.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={automation.name} className="max-w-lg">
      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-700">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-neutral-500">{automation.description}</p>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border-default px-4 py-3">
          <div>
            <p className="text-sm font-medium text-foreground">Estado</p>
            <Badge variant={enabled ? "success" : "neutral"} dot className="mt-1">
              {enabled ? "Activa" : "Inactiva"}
            </Badge>
          </div>
          <Switch checked={enabled} onChange={setEnabled} label={`Activar ${automation.name}`} />
        </div>

        {!automation.hasTrigger && (
          <p className="flex items-start gap-2 rounded-md bg-info-bg px-3 py-2 text-xs text-info-strong">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            La configuración se guarda, pero todavía no tiene un disparador automático conectado — es la próxima automatización a conectar.
          </p>
        )}
        {automation.hasTrigger && (
          <p className="flex items-start gap-2 rounded-md bg-info-bg px-3 py-2 text-xs text-info-strong">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            Cuando se dispara, crea una tarea con el mensaje y el link de WhatsApp ya armados para que lo mandes con un clic — WhatsApp no permite el envío 100% automático fuera de una conversación reciente.
          </p>
        )}

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">Canales</p>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={whatsappEnabled} onChange={(e) => setWhatsappEnabled(e.target.checked)} className="size-4 rounded-sm accent-accent-500" />
              WhatsApp
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" checked={emailEnabled} onChange={(e) => setEmailEnabled(e.target.checked)} className="size-4 rounded-sm accent-accent-500" />
              Email
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-400">
              <input type="checkbox" disabled className="size-4 rounded-sm" />
              SMS (deshabilitado por ahora)
            </label>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">Mensaje</p>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className={cn(
              "rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none",
              "transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)]",
              "focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100",
            )}
          />
          <div className="flex flex-wrap gap-1.5">
            {AUTOMATION_VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVariable(v.key)}
                className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-foreground transition-colors hover:bg-accent-100 hover:text-accent-700"
              >
                {`{{${v.key}}}`}
              </button>
            ))}
          </div>
        </div>

        <Button onClick={handleSave} loading={isSaving}>
          Guardar cambios
        </Button>
      </div>
    </Sheet>
  );
}
