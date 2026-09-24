"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Download, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/toast/toast";
import { createClient } from "@/lib/supabase/client";
import type { MyProfile } from "@/lib/profile/queries";
import { exportMyData, deleteMyAccount } from "@/lib/profile/actions";
import { ChangePasswordCard } from "./ChangePasswordCard";

const CONFIRM_WORD = "ELIMINAR";

/** "Cuenta" tab — the user's own spec lists "Datos personales/Cambiar
 * contraseña/Seguridad/Sesiones activas" here, which mostly overlaps with
 * Mi perfil + Seguridad. Reconciled as: a compact read-only summary (full
 * data lives in Mi perfil, not duplicated), the shared password-change
 * card, a shortcut into the full Seguridad tab, and two real actions
 * (exportar mis datos / eliminar cuenta) instead of the sheet re-building
 * the sessions list here too. */
export function AccountSection({ profile, onGoToSecurity }: { profile: MyProfile; onGoToSecurity: () => void }) {
  const router = useRouter();
  const [isExporting, startExport] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  function handleExport() {
    startExport(async () => {
      try {
        const data = await exportMyData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `growthlink-mis-datos-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Exportación descargada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo exportar tu información.");
      }
    });
  }

  function closeDeleteDialog() {
    setDeleteOpen(false);
    setConfirmText("");
    setDeleteError(null);
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteMyAccount();
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/login");
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "No se pudo eliminar la cuenta.");
      setIsDeleting(false);
    }
  }

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

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-surface-3 text-neutral-500">
              <Download className="size-[18px]" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium text-foreground">Exportar mis datos</p>
              <p className="text-[13px] text-neutral-500">Un archivo con tu perfil y tus sesiones. Se descarga directo.</p>
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={handleExport} loading={isExporting}>
            Descargar
          </Button>
        </div>
      </Card>

      <Card className="border border-error/30">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-error-bg text-error-strong">
              <Trash2 className="size-[18px]" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium text-error-strong">Eliminar cuenta</p>
              <p className="text-[13px] text-neutral-500">Borra tu usuario y tu acceso de forma permanente.</p>
            </div>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            Eliminar
          </Button>
        </div>
      </Card>

      <ConfirmDialog
        open={deleteOpen}
        title="Eliminar tu cuenta"
        description="Esto no se puede deshacer. Si sos el único Owner de algún workspace, primero transferí la propiedad desde Miembros — si no, esta acción se va a rechazar."
        confirmLabel="Eliminar cuenta"
        danger
        isLoading={isDeleting}
        confirmDisabled={confirmText !== CONFIRM_WORD}
        onConfirm={handleDelete}
        onCancel={closeDeleteDialog}
      >
        <Input
          label={`Para confirmar, escribí ${CONFIRM_WORD}`}
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          error={deleteError ?? undefined}
          autoComplete="off"
        />
      </ConfirmDialog>
    </div>
  );
}
