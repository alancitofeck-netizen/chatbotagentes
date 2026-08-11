"use client";

import { UserPlus, User, Phone, Mail, Sparkles, ArrowRight } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

/** Contenido del drawer "Crear Asesoría" — separado de AsesoriasListShell.tsx
 * por tamaño/legibilidad (mismo criterio que LeadDetailDrawer.tsx/
 * ReferralDetailSheet.tsx: un drawer con suficiente contenido propio vive en
 * su propio archivo). Puramente presentacional — el estado (nombre/teléfono/
 * correo/isPending) y el submit siguen viviendo en AsesoriasListShell.tsx,
 * exactamente como antes; esto solo cambia cómo se ve. */
export function CreateAsesoriaDrawer({
  open,
  onClose,
  name,
  onNameChange,
  phone,
  onPhoneChange,
  email,
  onEmailChange,
  onSubmit,
  isPending,
}: {
  open: boolean;
  onClose: () => void;
  name: string;
  onNameChange: (value: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
  isPending: boolean;
}) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      className="max-w-[480px]"
      title={
        <div className="flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-100 text-accent-700">
            <UserPlus className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-base leading-tight font-semibold text-foreground">Nueva asesoría</p>
            <p className="text-xs text-neutral-500">Comenzá una nueva sesión con un prospecto.</p>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-4 rounded-lg border border-border-default bg-surface-2 p-4">
          <div className="flex items-start gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-neutral-500">
              <User className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Información del prospecto</p>
              <p className="text-xs text-neutral-500">Estos datos son opcionales. Podés completarlos ahora o durante la asesoría.</p>
            </div>
          </div>

          <Input
            label="Nombre del prospecto"
            icon={User}
            uiSize="lg"
            placeholder="Nombre completo del prospecto"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
          />
          <Input
            label="Teléfono"
            icon={Phone}
            uiSize="lg"
            type="tel"
            placeholder="+54 9 ..."
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
          />
          <Input
            label="Correo electrónico (opcional)"
            icon={Mail}
            uiSize="lg"
            type="email"
            placeholder="nombre@empresa.com"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
          />
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-accent-200 bg-accent-50 p-3.5">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-accent-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-accent-700">Podés completar estos datos durante la asesoría.</p>
            <p className="text-xs text-neutral-500">No es necesario tener toda la información para comenzar.</p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="primary" size="lg" fullWidth loading={isPending} onClick={onSubmit}>
            {!isPending && <ArrowRight className="size-4" aria-hidden="true" />}
            Crear y comenzar asesoría
          </Button>
          <p className="text-center text-xs text-neutral-500">Podrás editar los datos después.</p>
        </div>
      </div>
    </Sheet>
  );
}
