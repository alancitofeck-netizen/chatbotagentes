"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { toast } from "@/components/toast/toast";
import { createMovimientoAction, updateMovimientoAction } from "@/lib/finanzas/actions";
import type { FinanzasMovimiento, FinanzasMovimientoInput } from "@/lib/finanzas/queries";
import {
  FINANZAS_CATEGORIES,
  FINANZAS_PAYMENT_METHODS,
  FINANZAS_CURRENCIES,
  categoriasFor,
  type FinanzasTipo,
  type FinanzasCategoria,
  type FinanzasEstado,
  type FinanzasRecurrencia,
} from "@/lib/finanzas/constants";
import { CATEGORY_ICON, METHOD_ICON } from "./FinanzasMobileItem";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const inputClass = "w-full rounded-xl border border-border-strong bg-surface-2 px-3 py-2.5 text-[15px] text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100";
const labelClass = "mb-1.5 mt-3 block text-[12px] font-semibold text-neutral-500";

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-[13px] font-medium ${active ? "border-accent-500 bg-accent-100 text-accent-700" : "border-border-default bg-surface-2 text-foreground"}`}
    >
      {children}
    </button>
  );
}

export function FinanzasMobileForm({
  movimiento,
  defaultTipo,
  defaultDate,
  onClose,
  onSaved,
}: {
  movimiento: FinanzasMovimiento | null;
  defaultTipo: FinanzasTipo;
  defaultDate?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tipo, setTipo] = useState<FinanzasTipo>(movimiento?.tipo ?? defaultTipo);
  const [categoria, setCategoria] = useState<FinanzasCategoria>(movimiento?.categoria ?? categoriasFor(movimiento?.tipo ?? defaultTipo)[0]);
  const [descripcion, setDescripcion] = useState(movimiento?.descripcion ?? "");
  const [monto, setMonto] = useState(movimiento ? String(movimiento.monto) : "");
  const [moneda, setMoneda] = useState(movimiento?.moneda ?? "USD");
  const [medioPago, setMedioPago] = useState(movimiento?.medioPago ?? "");
  const [detalleMedio, setDetalleMedio] = useState(movimiento?.detalleMedio ?? "");
  const [estado, setEstado] = useState<FinanzasEstado>(movimiento?.estado ?? (defaultTipo === "out" ? "pagado" : "pendiente"));
  const [fecha, setFecha] = useState(movimiento?.fechaVencimiento ?? defaultDate ?? todayIso());
  const [recurrencia, setRecurrencia] = useState<FinanzasRecurrencia>(movimiento?.recurrencia ?? "ninguna");
  const [contraparte, setContraparte] = useState(movimiento?.contraparte ?? "");
  const [notas, setNotas] = useState(movimiento?.notas ?? "");
  const [saving, setSaving] = useState(false);

  const categoriasDisponibles = categoriasFor(tipo);

  function handleTipoChange(next: FinanzasTipo) {
    if (movimiento) return; // al editar no se cambia el tipo, igual que el form de escritorio
    setTipo(next);
    setCategoria(categoriasFor(next)[0]);
    setEstado(next === "out" ? "pagado" : "pendiente");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const amountValue = Number(monto);
    if (!amountValue || amountValue <= 0) {
      toast.error("Ingresá un monto válido.");
      return;
    }
    if (!descripcion.trim()) {
      toast.error("Falta la descripción.");
      return;
    }
    if (tipo === "out" && !medioPago) {
      toast.error("Elegí el medio de pago.");
      return;
    }
    const input: FinanzasMovimientoInput = {
      tipo,
      categoria,
      descripcion,
      contraparte: contraparte || null,
      monto: amountValue,
      moneda,
      fechaVencimiento: fecha,
      medioPago: medioPago || null,
      detalleMedio: detalleMedio || null,
      estado,
      recurrencia,
      notas: notas || null,
    };
    setSaving(true);
    try {
      if (movimiento) await updateMovimientoAction(movimiento.id, input);
      else await createMovimientoAction(input);
      toast.success(movimiento ? "Cambios guardados" : "Guardado ✓");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={movimiento ? "Editar movimiento" : tipo === "out" ? "Nuevo gasto" : "Nuevo cobro"}>
      <form onSubmit={handleSubmit} className="flex flex-col p-5">
        {!movimiento && (
          <div className="mb-3.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleTipoChange("out")}
              className={`rounded-2xl border-2 p-2.5 text-[14px] font-semibold ${tipo === "out" ? "border-error-strong bg-error-bg text-error-strong" : "border-border-default bg-surface-2 text-foreground"}`}
            >
              ↑ Gasto
            </button>
            <button
              type="button"
              onClick={() => handleTipoChange("in")}
              className={`rounded-2xl border-2 p-2.5 text-[14px] font-semibold ${tipo === "in" ? "border-success-strong bg-success-bg text-success-strong" : "border-border-default bg-surface-2 text-foreground"}`}
            >
              ↓ Cobro
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 rounded-2xl border border-border-default bg-surface-2 px-3 py-2.5">
          <span className="font-mono text-[22px] text-neutral-500">$</span>
          <input
            value={monto}
            onChange={(e) => setMonto(e.target.value)}
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0"
            required
            className="min-w-0 flex-1 bg-transparent font-mono text-[28px] font-bold text-foreground outline-none"
          />
          <select value={moneda} onChange={(e) => setMoneda(e.target.value)} className="rounded-lg border border-border-default bg-surface-1 px-2 py-1.5 text-[14px] font-semibold text-foreground">
            {FINANZAS_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <label className={labelClass}>Descripción</label>
        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Ej: ManyChat Pro" required className={inputClass} />

        <label className={labelClass}>Categoría</label>
        <div className="flex flex-wrap gap-1.5">
          {categoriasDisponibles.map((c) => (
            <Chip key={c} active={categoria === c} onClick={() => setCategoria(c)}>
              {CATEGORY_ICON[c]} {FINANZAS_CATEGORIES[c].label}
            </Chip>
          ))}
        </div>

        <label className={labelClass}>{tipo === "out" ? "Medio de pago" : "Medio de cobro (opcional)"}</label>
        <div className="flex flex-wrap gap-1.5">
          {FINANZAS_PAYMENT_METHODS.map((m) => (
            <Chip key={m} active={medioPago === m} onClick={() => setMedioPago((cur) => (cur === m ? "" : m))}>
              {METHOD_ICON[m]} {m}
            </Chip>
          ))}
        </div>
        <input
          value={detalleMedio}
          onChange={(e) => setDetalleMedio(e.target.value)}
          placeholder="Detalle (opcional): Visa terminada en 4417, cuenta Galicia…"
          className={`${inputClass} mt-2`}
        />

        <label className={labelClass}>Estado</label>
        <div className="flex flex-wrap gap-1.5">
          {tipo === "out" ? (
            <>
              <Chip active={estado === "pagado"} onClick={() => setEstado("pagado")}>
                ✓ Ya lo pagué
              </Chip>
              <Chip active={estado === "pendiente"} onClick={() => setEstado("pendiente")}>
                ⏳ Pendiente
              </Chip>
            </>
          ) : (
            <>
              <Chip active={estado === "pendiente"} onClick={() => setEstado("pendiente")}>
                ⏳ Pendiente
              </Chip>
              <Chip active={estado === "pagado"} onClick={() => setEstado("pagado")}>
                ✓ Ya lo cobré
              </Chip>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className={labelClass}>Fecha</label>
            <input value={fecha} onChange={(e) => setFecha(e.target.value)} type="date" required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Se repite</label>
            <select value={recurrencia} onChange={(e) => setRecurrencia(e.target.value as FinanzasRecurrencia)} className={inputClass}>
              <option value="ninguna">No</option>
              <option value="mensual">Mensual</option>
              <option value="anual">Anual</option>
            </select>
          </div>
        </div>

        <label className={labelClass}>{tipo === "out" ? "Proveedor" : "Cliente"}</label>
        <input value={contraparte} onChange={(e) => setContraparte(e.target.value)} placeholder="Nombre" className={inputClass} />

        <label className={labelClass}>Notas</label>
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Opcional" className={inputClass} />

        <button type="submit" disabled={saving} className="mt-4 rounded-2xl bg-accent-600 p-3.5 text-[15px] font-bold text-[var(--on-accent)] disabled:opacity-60">
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </form>
    </Sheet>
  );
}
