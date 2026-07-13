"use client";

import { useState } from "react";
import { Mail, Phone, AtSign, Building2, Shield, CalendarDays, Image as ImageIcon } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import type { MyProfile } from "@/lib/profile/queries";
import { EditProfileSheet } from "./EditProfileSheet";

const ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  agent: "Agente",
  viewer: "Solo lectura",
};

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "long", year: "numeric" });
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <Icon className="size-4 shrink-0 text-neutral-400" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">{label}</p>
        <p className="truncate text-sm text-foreground">{value || "—"}</p>
      </div>
    </div>
  );
}

export function MyProfileSection({ profile, onChanged }: { profile: MyProfile; onChanged: () => void }) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          title="Información personal"
          action={<Button size="sm" onClick={() => setEditOpen(true)}>Editar perfil</Button>}
        />

        <div className="mb-4 flex items-center gap-4">
          <Avatar name={profile.fullName || profile.email} size={64} />
          <div className="flex flex-col gap-1">
            <button
              type="button"
              disabled
              title="Próximamente — requiere Supabase Storage"
              className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 disabled:cursor-not-allowed"
            >
              <ImageIcon className="size-3.5" aria-hidden="true" />
              Cambiar foto (próximamente)
            </button>
          </div>
        </div>

        <dl className="flex flex-col divide-y divide-border-default">
          <InfoRow icon={Shield} label="Nombre completo" value={profile.fullName} />
          <InfoRow icon={AtSign} label="Nombre de usuario" value={profile.username} />
          <InfoRow icon={Mail} label="Email" value={profile.email} />
          <InfoRow icon={Phone} label="Teléfono" value={profile.phone} />
          <InfoRow icon={Shield} label="Rol dentro del CRM" value={ROLE_LABEL[profile.role] ?? profile.role} />
          <InfoRow icon={Building2} label="Workspace" value={profile.workspaceName} />
          <InfoRow icon={CalendarDays} label="Cuenta creada" value={formatDate(profile.createdAt)} />
        </dl>
      </Card>

      {editOpen && (
        <EditProfileSheet
          profile={profile}
          onClose={() => setEditOpen(false)}
          onSaved={() => {
            setEditOpen(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
