"use client";

import { useState, useTransition } from "react";
import { FileText, Info, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/toast/toast";
import type { WhatsAppTemplate } from "@/lib/templates/queries";
import { createTemplate, deleteTemplate } from "@/lib/templates/actions";

const CATEGORY_OPTIONS: WhatsAppTemplate["category"][] = ["UTILITY", "MARKETING", "AUTHENTICATION"];
const LANGUAGE_OPTIONS = [
  { value: "es", label: "Español" },
  { value: "es_AR", label: "Español (Argentina)" },
  { value: "en", label: "Inglés" },
  { value: "en_US", label: "Inglés (EE.UU.)" },
  { value: "pt_BR", label: "Portugués (Brasil)" },
];

const STATUS_LABEL: Record<WhatsAppTemplate["status"], { label: string; variant: BadgeVariant }> = {
  pending: { label: "Pendiente", variant: "warning" },
  approved: { label: "Aprobada", variant: "success" },
  rejected: { label: "Rechazada", variant: "error" },
};

function CreateTemplateSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (t: WhatsAppTemplate) => void }) {
  const [wabaId, setWabaId] = useState("");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("es");
  const [category, setCategory] = useState<WhatsAppTemplate["category"]>("UTILITY");
  const [bodyText, setBodyText] = useState("");
  const [footerText, setFooterText] = useState("");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setWabaId("");
    setName("");
    setLanguage("es");
    setCategory("UTILITY");
    setBodyText("");
    setFooterText("");
  }

  function handleCreate() {
    startTransition(async () => {
      try {
        const { id } = await createTemplate({ wabaId, name, language, category, bodyText, footerText });
        toast.success("Plantilla enviada a revisión de Meta.");
        onCreated({
          id,
          ycloudTemplateId: "",
          name,
          language,
          category,
          status: "pending",
          rejectionReason: null,
          bodyText,
          createdAt: new Date().toISOString(),
        });
        reset();
        onClose();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo crear la plantilla.");
      }
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nueva plantilla">
      <div className="flex flex-col gap-4 p-5">
        <Input
          label="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase())}
          placeholder="ej. confirmacion_pedido"
          hint="Solo minúsculas, números y guion bajo — sin espacios."
        />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Categoría" value={category} onChange={(e) => setCategory(e.target.value as WhatsAppTemplate["category"])}>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
          <Select label="Idioma" value={language} onChange={(e) => setLanguage(e.target.value)}>
            {LANGUAGE_OPTIONS.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Cuerpo del mensaje</label>
          <textarea
            value={bodyText}
            onChange={(e) => setBodyText(e.target.value)}
            rows={4}
            placeholder={"Hola {{1}}, tu pedido #{{2}} fue confirmado."}
            className="rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] placeholder:text-neutral-400 focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
          <span className="text-xs text-neutral-500">Usá {"{{1}}"}, {"{{2}}"}… para variables.</span>
        </div>
        <Input
          label="Pie de página (opcional)"
          value={footerText}
          onChange={(e) => setFooterText(e.target.value)}
          placeholder="ej. Growth Link"
        />
        <Input
          label="WABA ID"
          value={wabaId}
          onChange={(e) => setWabaId(e.target.value)}
          placeholder="ID de tu WhatsApp Business Account"
          hint="Lo encontrás en tu dashboard de YCloud → Developers."
        />
        <Button onClick={handleCreate} loading={isPending}>
          Enviar a revisión
        </Button>
      </div>
    </Sheet>
  );
}

/** Gestión de plantillas de WhatsApp — solo gestión (crear/listar/sincronizar
 * estado/eliminar), no envío. Enviar una plantilla real desde una
 * conversación fuera de la ventana de 24h queda fuera de este alcance (es
 * una feature aparte del composer con sustitución de variables). */
export function TemplatesShell({
  initialTemplates,
  canManage,
  hasYCloudConnection,
}: {
  initialTemplates: WhatsAppTemplate[];
  canManage: boolean;
  hasYCloudConnection: boolean;
}) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete(template: WhatsAppTemplate) {
    if (!window.confirm(`¿Eliminar la plantilla "${template.name}"?`)) return;
    startTransition(async () => {
      try {
        await deleteTemplate(template.id);
        setTemplates((prev) => prev.filter((t) => t.id !== template.id));
        toast.success("Plantilla eliminada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo eliminar la plantilla.");
      }
    });
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-4 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-foreground">Plantillas</h1>
          <p className="text-sm text-neutral-500">
            Plantillas de WhatsApp aprobadas por Meta, requeridas para enviar mensajes fuera de la ventana de 24h.
          </p>
        </div>
        {canManage && hasYCloudConnection && (
          <Button onClick={() => setSheetOpen(true)}>
            <Plus size={15} aria-hidden="true" />
            Nueva plantilla
          </Button>
        )}
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-border-default bg-surface-1 p-3 text-sm text-neutral-500">
        <Info size={16} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden="true" />
        <span>Las plantillas aprobadas todavía no pueden enviarse desde una conversación — próximamente.</span>
      </div>

      {!hasYCloudConnection ? (
        <EmptyState
          icon={FileText}
          title="Conectá WhatsApp primero"
          description="Necesitás una conexión de YCloud activa en Configuración → Integraciones para crear plantillas."
        />
      ) : templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Todavía no hay plantillas"
          description={
            canManage
              ? "Creá tu primera plantilla para poder escribirle a un contacto fuera de la ventana de 24h."
              : "Un administrador todavía no creó ninguna plantilla."
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {templates.map((template) => {
            const status = STATUS_LABEL[template.status];
            return (
              <li key={template.id} className="flex flex-col gap-2 rounded-lg border border-border-default bg-surface-1 p-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-foreground">{template.name}</span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                  <Badge variant="neutral">{template.category}</Badge>
                  <Badge variant="neutral">{template.language}</Badge>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => handleDelete(template)}
                      disabled={isPending}
                      aria-label="Eliminar plantilla"
                      className="ml-auto flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  )}
                </div>
                {template.bodyText && <p className="text-sm text-neutral-600">{template.bodyText}</p>}
                {template.status === "rejected" && template.rejectionReason && (
                  <p className="text-xs text-error-strong">Motivo: {template.rejectionReason}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <CreateTemplateSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onCreated={(t) => setTemplates((prev) => [t, ...prev])}
      />
    </div>
  );
}
