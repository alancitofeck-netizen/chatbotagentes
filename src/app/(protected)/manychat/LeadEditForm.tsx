"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "@/components/toast/toast";
import { STAGES, type Lead, type StageId } from "@/lib/manychat/leads";
import { saveLeadEditAction, type LeadEdit } from "./actions";

const inputClass =
  "h-11 w-full rounded-xl border border-border-default bg-surface-1 px-3 text-base text-foreground outline-none placeholder:text-neutral-400 focus:border-accent-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-semibold text-neutral-500">{label}</span>
      {children}
    </label>
  );
}

/** Edición de un lead del tablero de ManyChat. Solo manda los campos que cambiaron: así un dato que no se tocó
 * sigue actualizándose desde la hoja. Se guarda en el CRM, nunca en la hoja. */
export function LeadEditForm({ lead, onDone }: { lead: Lead; onDone: () => void }) {
  const router = useRouter();
  const [saving, startSaving] = useTransition();
  const [nombre, setNombre] = useState(lead.nombre ?? "");
  const [telefono, setTelefono] = useState(lead.telefono ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [usuario, setUsuario] = useState(lead.usuario ?? "");
  const [etapa, setEtapa] = useState<StageId>(lead.etapa);
  const [valor, setValor] = useState(lead.valor ? String(lead.valor) : "");
  const [nota, setNota] = useState(lead.nota ?? "");

  function save() {
    const changes: LeadEdit = {};
    if (nombre.trim() !== (lead.nombre ?? "")) changes.nombre = nombre;
    if (telefono.trim() !== (lead.telefono ?? "")) changes.telefono = telefono;
    if (email.trim() !== (lead.email ?? "")) changes.email = email;
    if (usuario.trim() !== (lead.usuario ?? "")) changes.usuario = usuario;
    if (nota.trim() !== (lead.nota ?? "")) changes.nota = nota;
    if (etapa !== lead.etapa) changes.etapa = etapa;
    const valorNum = valor.trim() === "" ? 0 : Number(valor.replace(/[^\d.]/g, ""));
    if (Number.isNaN(valorNum)) {
      toast.error("El valor tiene que ser un número.");
      return;
    }
    if (valorNum !== (lead.valor || 0)) changes.valor = valorNum;

    if (Object.keys(changes).length === 0) {
      onDone();
      return;
    }
    startSaving(async () => {
      const result = await saveLeadEditAction(lead.ref, changes);
      if (!result.ok) {
        toast.error(result.error ?? "No se pudo guardar.");
        return;
      }
      toast.success("Lead actualizado.");
      onDone();
      router.refresh();
    });
  }

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Field label="Estado">
        <select value={etapa} onChange={(e) => setEtapa(e.target.value as StageId)} className={inputClass}>
          {STAGES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Nombre">
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="off" className={inputClass} />
        </Field>
        <Field label="Teléfono">
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" autoComplete="off" className={inputClass} />
        </Field>
        <Field label="Email">
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="off" className={inputClass} />
        </Field>
        <Field label="Usuario de Instagram">
          <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="off" className={inputClass} />
        </Field>
        <Field label="Valor">
          <input value={valor} onChange={(e) => setValor(e.target.value)} inputMode="decimal" placeholder="0" autoComplete="off" className={inputClass} />
        </Field>
      </div>
      <Field label="Nota">
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={3}
          className="w-full rounded-xl border border-border-default bg-surface-1 px-3 py-2 text-base text-foreground outline-none focus:border-accent-500"
        />
      </Field>
      <p className="text-[12px] text-neutral-500">Los cambios se guardan en el CRM; tu hoja de Google no se modifica.</p>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-accent-600 px-4 text-[14px] font-semibold text-[var(--on-accent)] hover:bg-accent-700 disabled:opacity-70"
        >
          {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Guardar
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={saving}
          className="h-11 rounded-xl border border-border-default bg-surface-1 px-4 text-[14px] font-semibold text-foreground hover:border-border-strong"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
