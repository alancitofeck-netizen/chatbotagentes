"use client";

import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { MyProfile } from "@/lib/profile/queries";
import { ChangePasswordCard } from "./ChangePasswordCard";

/** "Cuenta" tab — the user's own spec lists "Datos personales/Cambiar
 * contraseña/Seguridad/Sesiones activas" here, which mostly overlaps with
 * Mi perfil + Seguridad. Reconciled as: a compact read-only summary (full
 * data lives in Mi perfil, not duplicated), the shared password-change
 * card, and a shortcut into the full Seguridad tab instead of re-building
 * the sessions list here too. */
export function AccountSection({ profile, onGoToSecurity }: { profile: MyProfile; onGoToSecurity: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <h2 className="mb-3 text-[15px] font-medium text-foreground">Datos personales</h2>
        <p className="text-sm text-neutral-500">
          {profile.fullName} · {profile.email}
          {profile.phone && ` · ${profile.phone}`}
        </p>
        <p className="mt-1 text-[13px] text-neutral-400">Editable desde la pestaña &ldquo;Mi perfil&rdquo;.</p>
      </Card>

      <ChangePasswordCard />

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-accent-100 text-accent-700">
              <ShieldCheck className="size-[18px]" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">Seguridad</p>
              <p className="text-[13px] text-neutral-500">2FA, sesiones activas y cierre de sesión remoto.</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={onGoToSecurity}>
            Ver
          </Button>
        </div>
      </Card>
    </div>
  );
}
