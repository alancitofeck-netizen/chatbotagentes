"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { createMovimientoAction, updateMovimientoAction } from "@/lib/finanzas/actions";
import type { FinanzasMovimiento, FinanzasMovimientoInput } from "@/lib/finanzas/queries";
import {
  FINANZAS_CATEGORIES,
  FINANZAS_PAYMENT_METHODS,
  FINANZAS_CURRENCIES,
  FINANZAS_RECURRENCIAS,
  categoriasFor,
  type FinanzasTipo,
  type FinanzasCategoria,
  type FinanzasEstado,
  type FinanzasRecurrencia,
} from "@/lib/finanzas/constants";

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function FinanzasMovimientoForm({
  movimiento,
  defaultTipo,
  onClose,
  onSaved,
}: {
  movimiento: FinanzasMovimiento | null;
  defaultTipo: FinanzasTipo;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tipo, setTipo] = useState<FinanzasTipo>(movimiento?.tipo ?? defaultTipo);
  const categoriasDisponibles = categoriasFor(tipo);
  const [categoria, setCategoria] = useState<FinanzasCategoria>(movimiento?.categoria ?? categoriasDisponibles[0]);
  const [descripcion, setDescripcion] = useState(movimiento?.descripcion ?? "");
  const [contraparte, setContraparte] = useState(movimiento?.contraparte ?? "");
  const [monto, setMonto] = useState(movimiento ? String(movimiento.monto) : "");
  const [moneda, setMoneda] = useState(movimiento?.moneda ?? "USD");
  const [fecha, setFecha] = useState(movimiento?.fechaVencimiento ?? todayIso());
  const [medioPago, setMedioPago] = useState(movimiento?.medioPago ?? "");
  const [detalleMedio, setDetalleMedio] = useState(movimiento?.detalleMedio ?? "");
  const [estado, setEstado] = useState<FinanzasEstado>(movimiento?.estado ?? (defaultTipo === "out" ? "pagado" : "pendiente"));
  const [recurrencia, setRecurrencia] = useState<FinanzasRecurrencia>(movimiento?.recurrencia ?? "ninguna");
  const [notas, setNotas] = useState(movimiento?.notas ?? "");
  const [saving, setSaving] = useState(false);

  function handleTipoChange(next: FinanzasTipo) {
    setTipo(next);
    const opts = categoriasFor(next);
    setCategoria(opts[0]);
    setEstado(next === "out" ? "pagado" : "pendiente");
  }

  async function handleSave() {
    const amountValue = Number(monto);
    if (!amountValue || amountValue <= 0) {
      toast.error("Ingresá un monto válido.");
      return;
    }
    if (tipo === "out" && !medioPago) {
      toast.error("El medio de pago es obligatorio para los gastos.");
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
      toast.success(movimiento ? "Movimiento actualizado." : tipo === "in" ? "Cobro creado." : "Gasto creado.");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar el movimiento.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={movimiento ? "Editar movimiento" : tipo === "in" ? "Nuevo cobro" : "Nuevo gasto"}>
      <div className="flex flex-col gap-4 p-5">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => handleTipoChange("in")}
            className={`rounded-lg border-2 p-3 text-left text-sm font-semibold ${tipo === "in" ? "border-success-strong bg-success-bg text-success-strong" : "border-border-default text-foreground"}`}
          >
            ↓ Por cobrar
            <span className="block text-xs font-normal text-neutral-500">Pólizas, asesorías, ventas</span>
          </button>
          <button
            type="button"
            onClick={() => handleTipoChange("out")}
            className={`rounded-lg border-2 p-3 text-left text-sm font-semibold ${tipo === "out" ? "border-error-strong bg-error-bg text-error-strong" : "border-border-default text-foreground"}`}
          >
            ↑ Por pagar
            <span className="block text-xs font-normal text-neutral-500">Herramientas, cursos, gastos</span>
          </button>
        </div>

        <Input label="Descripción" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder='Ej: Asesoría fiscal mensual' />

        <Select label="Categoría" value={categoria} onChange={(e) => setCategoria(e.target.value as FinanzasCategoria)}>
          {categoriasDisponibles.map((c) => (
            <option key={c} value={c}>
              {FINANZAS_CATEGORIES[c].label}
            </option>
          ))}
        </Select>

        <Input label={tipo === "in" ? "Cliente" : "Proveedor"} value={contraparte} onChange={(e) => setContraparte(e.target.value)} placeholder="Nombre" />

        <div className="flex gap-2">
          <Input label="Monto" type="number" min="0" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} containerClassName="flex-1" />
          <Select label="Moneda" value={moneda} onChange={(e) => setMoneda(e.target.value)} containerClassName="w-28">
            {FINANZAS_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>

        <Input label="Vence el" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />

        <Select label={tipo === "in" ? "Medio de cobro" : "Medio de pago"} value={medioPago} onChange={(e) => setMedioPago(e.target.value)}>
          <option value="">Elegí un medio…</option>
          {FINANZAS_PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </Select>

        <Select label="Estado" value={estado} onChange={(e) => setEstado(e.target.value as FinanzasEstado)}>
          {tipo === "out" ? (
            <>
              <option value="pagado">✓ Ya lo pagué</option>
              <option value="pendiente">Pendiente de pago</option>
            </>
          ) : (
            <>
              <option value="pendiente">Pendiente de cobro</option>
              <option value="pagado">✓ Ya lo cobré</option>
            </>
          )}
        </Select>

        <Input label="Detalle del medio (opcional)" value={detalleMedio} onChange={(e) => setDetalleMedio(e.target.value)} placeholder="Ej: Visa terminada en 4417 · cuenta Galicia" />

        <Select label="Se repite" value={recurrencia} onChange={(e) => setRecurrencia(e.target.value as FinanzasRecurrencia)}>
          {FINANZAS_RECURRENCIAS.map((r) => (
            <option key={r} value={r}>
              {r === "ninguna" ? "No se repite" : r === "mensual" ? "Mensual" : "Anual"}
            </option>
          ))}
        </Select>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-foreground">Notas</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            placeholder="Opcional"
            className="rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        </div>

        <Button onClick={handleSave} loading={saving}>
          Guardar
        </Button>
      </div>
    </Sheet>
  );
}
