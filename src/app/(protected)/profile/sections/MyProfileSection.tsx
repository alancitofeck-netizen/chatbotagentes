"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Mail,
  Phone,
  AtSign,
  Building2,
  Shield,
  CalendarDays,
  Image as ImageIcon,
  Pencil,
  Briefcase,
  AlignLeft,
  type LucideIcon,
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { toast } from "@/components/toast/toast";
import { cn } from "@/lib/utils/cn";
import type { MyProfile } from "@/lib/profile/queries";
import { updateMyProfile } from "@/lib/profile/actions";
import { AvatarUploadDialog } from "./AvatarUploadDialog";
import { useCompactPreference } from "../useCompactPreference";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  agent: "Agente",
};

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "long", year: "numeric" });
}

interface EditableFieldDef {
  id: "fullName" | "username" | "phone" | "title" | "bio";
  label: string;
  icon: LucideIcon;
  placeholder: string;
  multi?: boolean;
  optional?: boolean;
  hint?: string;
  /** Devuelve un mensaje de error, o undefined si es válido. Nunca corre
   * sobre un campo opcional vacío. */
  validate?: (value: string) => string | undefined;
}

const FIELDS: EditableFieldDef[] = [
  {
    id: "fullName",
    label: "Nombre completo",
    icon: Shield,
    placeholder: "Tu nombre y apellido",
    validate: (v) => (v.trim().length >= 2 ? undefined : "Escribí al menos 2 letras."),
  },
  {
    id: "username",
    label: "Nombre de usuario",
    icon: AtSign,
    placeholder: "usuario",
    optional: true,
    hint: "Solo visual — no reemplaza al email para iniciar sesión.",
    validate: (v) => (/^[a-z0-9._]{3,20}$/.test(v) ? undefined : "Usá de 3 a 20 letras, números, puntos o guiones bajos."),
  },
  {
    id: "phone",
    label: "Teléfono",
    icon: Phone,
    placeholder: "+54 9 ...",
    optional: true,
  },
  {
    id: "title",
    label: "Cargo",
    icon: Briefcase,
    placeholder: "Por ejemplo, Productor asesor de seguros",
    optional: true,
  },
  {
    id: "bio",
    label: "Sobre vos",
    icon: AlignLeft,
    placeholder: "Una o dos líneas que vean tus clientes.",
    multi: true,
    optional: true,
    validate: (v) => (v.length <= 240 ? undefined : "Máximo 240 caracteres."),
  },
];

function InfoRow({ icon: Icon, label, value, compact }: { icon: LucideIcon; label: string; value: string; compact?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3", compact ? "py-1.5" : "py-2.5")}>
      <Icon className="size-4 shrink-0 text-neutral-400" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">{label}</p>
        <p className="truncate text-sm text-foreground">{value || "—"}</p>
      </div>
    </div>
  );
}

/** Fila de campo editable inline (puerto de la interacción "clic en la fila
 * → editor con Guardar/Cancelar" de configuracion-premium.html) en vez del
 * sheet único que había antes — mismo `updateMyProfile()` de siempre, ahora
 * llamado por campo (siempre con el snapshot local completo, ya que
 * `auth.updateUser({data})` mergea por clave, no reemplaza — ver el
 * comentario de esa función). */
/** Mounted only while its field is being edited (parent unmounts it
 * otherwise) — draft/error state is seeded straight from `value` as the
 * initial state, no reset-on-prop-change effect needed, since remounting
 * itself (a fresh field.id starting to edit) already gives it a clean
 * slate. Autofocus is the one legitimate effect here (an imperative DOM
 * action, not a setState call). */
function FieldEditor({
  field,
  value,
  isSaving,
  onCancel,
  onSave,
}: {
  field: EditableFieldDef;
  value: string;
  isSaving: boolean;
  onCancel: () => void;
  onSave: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSave() {
    const trimmed = field.multi ? draft : draft.trim();
    if (!(field.optional && !trimmed) && field.validate) {
      const err = field.validate(trimmed);
      if (err) {
        setError(err);
        return;
      }
    }
    onSave(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    } else if (e.key === "Enter" && (!field.multi || e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSave();
    }
  }

  const Icon = field.icon;

  return (
    <div className="flex items-start gap-3 rounded-md bg-surface-2 py-2.5">
      <Icon className="mt-2.5 size-4 shrink-0 text-accent-600" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <label className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">{field.label}</label>
        {field.multi ? (
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={field.placeholder}
            maxLength={280}
            rows={3}
            className="w-full resize-y rounded-md border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        ) : (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={field.placeholder}
            className="w-full rounded-md border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        )}
        <div className="flex items-center gap-2">
          <button type="button" onClick={handleSave} disabled={isSaving} className="rounded-md bg-accent-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-accent-700 disabled:opacity-60">
            {isSaving ? "Guardando…" : "Guardar"}
          </button>
          <button type="button" onClick={onCancel} disabled={isSaving} className="rounded-md px-2.5 py-1 text-xs font-medium text-neutral-500 hover:bg-surface-3">
            Cancelar
          </button>
          <span className="ml-auto text-[11px] text-neutral-400">
            {error ? <span className="text-error">{error}</span> : field.multi ? `${draft.length}/240` : field.hint}
          </span>
        </div>
      </div>
    </div>
  );
}

/** Dispatcher — fila de solo lectura (clic para editar) o `FieldEditor`
 * mientras `isEditing`. Ver el comentario de `FieldEditor` sobre por qué
 * el editor es un componente aparte que se monta/desmonta en vez de un
 * único componente con un efecto de reset. */
function EditableRow({
  field,
  value,
  isEditing,
  isSaving,
  compact,
  onStartEdit,
  onCancel,
  onSave,
}: {
  field: EditableFieldDef;
  value: string;
  isEditing: boolean;
  isSaving: boolean;
  compact?: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onSave: (next: string) => void;
}) {
  if (isEditing) {
    return <FieldEditor field={field} value={value} isSaving={isSaving} onCancel={onCancel} onSave={onSave} />;
  }

  const Icon = field.icon;
  return (
    <div className={cn("group flex items-center gap-3", compact ? "py-1.5" : "py-2.5")}>
      <Icon className="size-4 shrink-0 text-neutral-400" />
      <button type="button" onClick={onStartEdit} className="min-w-0 flex-1 text-left">
        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">{field.label}</p>
        <p className={value ? "truncate text-sm text-foreground" : "truncate text-sm italic text-neutral-400"}>
          {value || (field.optional ? "Agregar" : "Sin completar")}
        </p>
      </button>
      <button
        type="button"
        onClick={onStartEdit}
        className="shrink-0 rounded-md p-1.5 text-neutral-400 opacity-0 transition-opacity hover:bg-surface-2 hover:text-foreground group-hover:opacity-100"
        aria-label={`Editar ${field.label}`}
      >
        <Pencil className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export function MyProfileSection({ profile, onChanged }: { profile: MyProfile; onChanged: () => void }) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl);
  const [editingId, setEditingId] = useState<EditableFieldDef["id"] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [compact] = useCompactPreference();

  const values: Record<EditableFieldDef["id"], string> = {
    fullName: profile.fullName,
    username: profile.username,
    phone: profile.phone,
    title: profile.title,
    bio: profile.bio,
  };

  function handleSaveField(id: EditableFieldDef["id"], next: string) {
    startTransition(async () => {
      try {
        await updateMyProfile({ ...values, [id]: next });
        setEditingId(null);
        onChanged();
        toast.success(`${FIELDS.find((f) => f.id === id)?.label} actualizado.`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar el cambio.");
      }
    });
  }

  // Anillo de completitud — solo sobre señales reales (nunca inventadas):
  // foto + los 5 campos editables de arriba. Sugiere el próximo paso.
  const checks = useMemo(
    () => [
      { id: "avatar" as const, label: "una foto de perfil", ok: Boolean(avatarUrl), act: () => setPhotoOpen(true) },
      ...FIELDS.map((f) => ({ id: f.id, label: f.label.toLowerCase(), ok: Boolean(values[f.id]), act: () => setEditingId(f.id) })),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [avatarUrl, profile.fullName, profile.username, profile.phone, profile.title, profile.bio],
  );
  const doneCount = checks.filter((c) => c.ok).length;
  const percent = Math.round((doneCount / checks.length) * 100);
  const nextStep = checks.find((c) => !c.ok);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className={compact ? "mb-3 flex items-center gap-4" : "mb-4 flex items-center gap-4"}>
          <button type="button" onClick={() => setPhotoOpen(true)} className="shrink-0" aria-label="Cambiar foto de perfil">
            <Avatar name={profile.fullName || profile.email} src={avatarUrl} size={64} />
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="truncate text-[17px] font-semibold text-foreground">{profile.fullName || "Sin nombre"}</p>
            <button
              type="button"
              onClick={() => setPhotoOpen(true)}
              className="flex w-fit items-center gap-1.5 text-xs font-medium text-accent-600 hover:text-accent-700"
            >
              <ImageIcon className="size-3.5" aria-hidden="true" />
              Cambiar foto
            </button>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <div className="relative flex size-14 items-center justify-center">
              <svg viewBox="0 0 56 56" width="56" height="56" className="-rotate-90">
                <circle cx="28" cy="28" r="24" fill="none" stroke="var(--border-default)" strokeWidth="5" />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="none"
                  stroke="var(--color-accent-500)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeDasharray="150.8"
                  strokeDashoffset={150.8 * (1 - percent / 100)}
                  style={{ transition: "stroke-dashoffset 0.6s ease" }}
                />
              </svg>
              <span className="absolute text-[13px] font-semibold text-foreground">{percent}%</span>
            </div>
            {nextStep ? (
              <button type="button" onClick={nextStep.act} className="text-right text-[11px] font-medium text-accent-600 hover:underline">
                Agregar {nextStep.label}
              </button>
            ) : (
              <span className="text-[11px] text-neutral-400">Perfil completo</span>
            )}
          </div>
        </div>

        <CardHeader title="Información personal" className={compact ? "mb-2" : undefined} />
        <dl className="flex flex-col divide-y divide-border-default">
          {FIELDS.map((field) => (
            <EditableRow
              key={field.id}
              field={field}
              value={values[field.id]}
              isEditing={editingId === field.id}
              isSaving={isPending && editingId === field.id}
              compact={compact}
              onStartEdit={() => setEditingId(field.id)}
              onCancel={() => setEditingId(null)}
              onSave={(next) => handleSaveField(field.id, next)}
            />
          ))}
          <InfoRow icon={Mail} label="Email" value={profile.email} compact={compact} />
        </dl>
      </Card>

      <Card>
        <CardHeader title="Datos del workspace" />
        <p className="mb-3 text-[13px] text-neutral-500">Los asigna el workspace, no se editan desde tu perfil.</p>
        <dl className="flex flex-col divide-y divide-border-default">
          <InfoRow icon={Shield} label="Rol dentro del CRM" value={ROLE_LABEL[profile.role] ?? profile.role} compact={compact} />
          <InfoRow icon={Building2} label="Workspace" value={profile.workspaceName} compact={compact} />
          <InfoRow icon={CalendarDays} label="Cuenta creada" value={formatDate(profile.createdAt)} compact={compact} />
        </dl>
      </Card>

      <AvatarUploadDialog
        open={photoOpen}
        onClose={() => setPhotoOpen(false)}
        onUploaded={(url) => {
          setAvatarUrl(url);
          onChanged();
        }}
      />
    </div>
  );
}
