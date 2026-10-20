"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "@/components/toast/toast";
import type { EstadoCita } from "@/lib/agenda/queries";
import { ESTADO_CITA_META, ESTADO_CITA_OPTIONS } from "@/lib/agenda/estadoMeta";
import { updateEstadoCitaAction, updateCitaNotasAction, createAgendaLeadAction, updateManualAgendaLeadAction, deleteManualAgendaLeadAction } from "@/lib/agenda/actions";
import type { SheetWriteBackStatus } from "@/lib/advisorSync/writeBack";

export interface AgendaRecordFormRecord {
  appointmentId: string;
  appointmentWorkspaceId: string;
  name: string;
  phone: string | null;
  email: string | null;
  producto: string | null;
  appointmentType: string | null;
  setterName: string | null;
  notas: string | null;
  estadoCita: EstadoCita;
  startTime: string;
  sinHora: boolean;
  /** true = la cita viene de una hoja conectada: acá solo se puede tocar estado + notas, el resto
   * se muestra de solo lectura (se resincroniza solo). false = carga a mano: todo editable + borrar. */
  fromSheet: boolean;
}

function notifySheetResult(sheet: SheetWriteBackStatus) {
  if (sheet === "written") return toast.success("Guardado", "También se actualizó en la hoja.");
  if (sheet === "no_token") return toast.info("Guardado en el CRM", "Para escribirlo en la hoja, conectá la cuenta de Google en Configurar.");
  if (sheet === "row_moved") return toast.info("Guardado en el CRM", "La fila de la hoja cambió de lugar: tocá Sincronizar ahora y volvé a intentar.");
  if (sheet === "no_estado_column") return toast.info("Guardado en el CRM", "La hoja no tiene una columna mapeada para este campo.");
  if (sheet === "error") return toast.error("Guardado en el CRM", "No se pudo escribir en la hoja.");
  return toast.success("Guardado");
}

function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toTimeInputValue(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function buildStartTime(fecha: string, hora: string | null): Date {
  const [y, m, d] = fecha.split("-").map(Number);
  if (hora) {
    const [hh, mm] = hora.split(":").map(Number);
    return new Date(y, m - 1, d, hh, mm);
  }
  return new Date(y, m - 1, d, 0, 0);
}

const fieldClass = "min-h-11 w-full rounded-md border border-border-strong bg-surface-1 px-3 text-[14px] text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100 disabled:border-border-default disabled:bg-surface-2 disabled:text-neutral-500";
const labelClass = "flex flex-col gap-1 text-[13px] font-medium text-foreground";

/** Formulario compartido de "editar/crear lead" (contenido puro — el llamador lo envuelve en un
 * <Sheet>, con `key` sobre el id del registro para que se reinicie solo al cambiar de lead/cita,
 * mismo criterio que AgendaLeadDetailPanel/AgendaCitaDetailPanel).
 *
 * Tres casos, un solo componente (pedido: "la forma de editar el lead" tiene que verse y
 * funcionar como el mockup, pero sin inventar edición donde no hay un dato real que respalde):
 *  - `record` ausente → alta a mano ("+ Nuevo lead"/"Nueva cita"), todo editable.
 *  - `record.fromSheet` → viene de una hoja conectada: solo Estado + Notas, el resto solo lectura
 *    (si se edita acá se pisa solo en la próxima sincronización).
 *  - `record` sin `fromSheet` → carga a mano previa: todo editable, + Eliminar. */
export function AgendaRecordForm({ record, defaultDate, onClose, onSaved }: { record?: AgendaRecordFormRecord | null; defaultDate?: Date; onClose: () => void; onSaved: () => void }) {
  const isEdit = Boolean(record);
  const locked = record?.fromSheet ?? false;
  const initialDate = record ? new Date(record.startTime) : (defaultDate ?? new Date());

  const [name, setName] = useState(record?.name ?? "");
  const [phone, setPhone] = useState(record?.phone ?? "");
  const [email, setEmail] = useState(record?.email ?? "");
  const [producto, setProducto] = useState(record?.producto ?? "");
  const [appointmentType, setAppointmentType] = useState(record?.appointmentType ?? "");
  const [setterName, setSetterName] = useState(record?.setterName ?? "");
  const [notas, setNotas] = useState(record?.notas ?? "");
  const [estadoCita, setEstadoCita] = useState<EstadoCita>(record?.estadoCita ?? "agendada");
  const [fecha, setFecha] = useState(toDateInputValue(initialDate));
  const [hora, setHora] = useState(record && !record.sinHora ? toTimeInputValue(initialDate) : "");
  const [sinHora, setSinHora] = useState(record?.sinHora ?? true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Falta el nombre del lead.");
      return;
    }
    setSaving(true);
    try {
      if (!record) {
        await createAgendaLeadAction({
          name,
          phone: phone.trim() || null,
          email: email.trim() || null,
          producto: producto.trim() || null,
          appointmentType: appointmentType.trim() || null,
          setterName: setterName.trim() || null,
          notas: notas.trim() || null,
          estadoCita,
          startTime: buildStartTime(fecha, sinHora ? null : hora).toISOString(),
          sinHora,
        });
        toast.success("Lead creado");
      } else if (locked) {
        const tasks: Promise<{ sheet: SheetWriteBackStatus }>[] = [];
        if (estadoCita !== record.estadoCita) tasks.push(updateEstadoCitaAction(record.appointmentId, record.appointmentWorkspaceId, estadoCita));
        if (notas.trim() !== (record.notas ?? "")) tasks.push(updateCitaNotasAction(record.appointmentId, record.appointmentWorkspaceId, notas));
        const results = await Promise.all(tasks);
        if (results.length > 0) notifySheetResult(results[results.length - 1].sheet);
        else toast.info("Sin cambios");
      } else {
        await updateManualAgendaLeadAction(record.appointmentId, record.appointmentWorkspaceId, {
          name,
          phone: phone.trim() || null,
          email: email.trim() || null,
          producto: producto.trim() || null,
          appointmentType: appointmentType.trim() || null,
          setterName: setterName.trim() || null,
          notas: notas.trim() || null,
          estadoCita,
          startTime: buildStartTime(fecha, sinHora ? null : hora).toISOString(),
          sinHora,
        });
        toast.success("Guardado");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!record || record.fromSheet) return;
    if (!window.confirm("¿Eliminar este lead y su cita? Esta acción no se puede deshacer.")) return;
    setDeleting(true);
    try {
      await deleteManualAgendaLeadAction(record.appointmentId, record.appointmentWorkspaceId);
      toast.success("Eliminado");
      onSaved();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 p-5">
      {locked && (
        <p className="rounded-md bg-surface-2 px-3 py-2 text-[12.5px] text-neutral-600">
          Estos datos vienen de tu hoja conectada. Para cambiarlos, editá tu hoja y tocá Sincronizar ahora — acá solo podés actualizar el estado y las notas.
        </p>
      )}

      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">Lead</span>
        <label className={labelClass}>
          Nombre completo
          <input value={name} onChange={(e) => setName(e.target.value)} disabled={locked} required className={fieldClass} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Teléfono
            <input value={phone ?? ""} onChange={(e) => setPhone(e.target.value)} disabled={locked} type="tel" className={fieldClass} />
          </label>
          <label className={labelClass}>
            Producto
            <input value={producto ?? ""} onChange={(e) => setProducto(e.target.value)} disabled={locked} placeholder="Sin definir" className={fieldClass} />
          </label>
        </div>
        <label className={labelClass}>
          Email
          <input value={email ?? ""} onChange={(e) => setEmail(e.target.value)} disabled={locked} type="email" placeholder="opcional" className={fieldClass} />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">Cita</span>
        <div className="grid grid-cols-2 gap-3">
          <label className={labelClass}>
            Fecha
            <input value={fecha} onChange={(e) => setFecha(e.target.value)} disabled={locked} type="date" required className={fieldClass} />
          </label>
          <label className={labelClass}>
            Hora
            <input
              value={hora}
              onChange={(e) => {
                setHora(e.target.value);
                setSinHora(!e.target.value);
              }}
              disabled={locked}
              type="time"
              placeholder="Sin hora"
              className={fieldClass}
            />
          </label>
        </div>
        <label className={labelClass}>
          Tipo de cita
          <input value={appointmentType ?? ""} onChange={(e) => setAppointmentType(e.target.value)} disabled={locked} placeholder="Primera cita, seguimiento…" className={fieldClass} />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-foreground">Estado de la cita</span>
          <div className="flex flex-wrap gap-1.5">
            {ESTADO_CITA_OPTIONS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setEstadoCita(e)}
                aria-pressed={estadoCita === e}
                className={`h-10 rounded-md border px-3 text-[13px] font-medium ${
                  estadoCita === e ? "border-[#0F1B22] bg-[#0F1B22] text-white" : "border-border-strong bg-surface-1 text-foreground hover:bg-surface-2"
                }`}
              >
                {ESTADO_CITA_META[e].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">Equipo</span>
        <label className={labelClass}>
          Setter
          <input value={setterName ?? ""} onChange={(e) => setSetterName(e.target.value)} disabled={locked} placeholder="Sin asignar" className={fieldClass} />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">Notas</span>
        <textarea
          value={notas ?? ""}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Qué busca, objeciones, presupuesto…"
          rows={4}
          className="w-full resize-y rounded-md border border-border-strong bg-surface-1 px-3 py-2 text-[14px] text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />
      </div>

      <button type="submit" disabled={saving || deleting} className="h-12 rounded-md bg-accent-500 text-[15px] font-semibold text-white hover:bg-accent-600 disabled:opacity-60">
        {saving ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear lead"}
      </button>
      {isEdit && !locked && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={saving || deleting}
          className="flex h-11 items-center justify-center gap-1.5 rounded-md border border-error-bg bg-surface-1 text-[13.5px] font-medium text-error-strong hover:bg-error-bg disabled:opacity-60"
        >
          <Trash2 size={14} aria-hidden="true" /> {deleting ? "Eliminando…" : record?.appointmentType ? "Eliminar cita" : "Eliminar lead"}
        </button>
      )}
    </form>
  );
}
