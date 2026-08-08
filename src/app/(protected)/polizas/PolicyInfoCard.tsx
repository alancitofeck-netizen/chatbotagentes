import { CalendarRange, Phone, Mail } from "lucide-react";

/** Tarjetas compactas de contacto/vigencia — mismo lenguaje visual que
 * LeadContactCard.tsx (Mini Apps), componente propio de Pólizas ya que cada
 * módulo tiene los suyos aunque compartan estilo (ver plan de esta tarea).
 * Cada celda es condicional al dato: nunca se muestra un placeholder
 * inventado para un campo que la póliza no trae. */
export function PolicyInfoCard({
  vigenciaLabel,
  phone,
  email,
}: {
  vigenciaLabel?: string | null;
  phone?: string | null;
  email?: string | null;
}) {
  if (!vigenciaLabel && !phone && !email) return null;

  return (
    <div className="grid grid-cols-2 gap-3">
      {vigenciaLabel && (
        <div className="col-span-2 rounded-xl border border-border-default bg-surface-2 p-3.5">
          <p className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">Vigencia</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
            <CalendarRange className="size-3.5 text-accent-600" aria-hidden="true" />
            {vigenciaLabel}
          </p>
        </div>
      )}
      {phone && (
        <div className="rounded-xl border border-border-default bg-surface-2 p-3.5">
          <p className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">Teléfono</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-foreground">
            <Phone className="size-3.5 text-accent-600" aria-hidden="true" />
            {phone}
          </p>
        </div>
      )}
      {email && (
        <div className={`rounded-xl border border-border-default bg-surface-2 p-3.5 ${!phone ? "col-span-2" : ""}`}>
          <p className="text-[11px] font-medium tracking-wide text-neutral-400 uppercase">Email</p>
          <p className="mt-1 flex items-center gap-1.5 truncate text-sm text-foreground">
            <Mail className="size-3.5 shrink-0 text-accent-600" aria-hidden="true" />
            <span className="truncate">{email}</span>
          </p>
        </div>
      )}
    </div>
  );
}
