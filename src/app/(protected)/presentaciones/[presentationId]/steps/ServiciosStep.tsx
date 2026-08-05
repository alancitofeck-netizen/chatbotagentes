"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { CommercialInfo } from "@/lib/presentations/constants";
import { CURRENCY_OPTIONS } from "@/lib/presentations/constants";

function TextField({
  data,
  onChange,
  field,
  label,
  placeholder,
}: {
  data: CommercialInfo;
  onChange: (data: CommercialInfo) => void;
  field: keyof CommercialInfo;
  label: string;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      <textarea
        value={(data[field] as string | undefined) ?? ""}
        onChange={(e) => onChange({ ...data, [field]: e.target.value })}
        rows={3}
        placeholder={placeholder}
        className="rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
      />
    </div>
  );
}

export function ServiciosStep({ data, onChange }: { data: CommercialInfo; onChange: (data: CommercialInfo) => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Servicios</h2>
        <p className="text-sm text-neutral-500">Información comercial — la IA la usa para armar tu propuesta de valor.</p>
      </div>

      <TextField data={data} onChange={onChange} field="services" label="Servicios" placeholder="¿Qué servicios ofrecés?" />
      <TextField data={data} onChange={onChange} field="products" label="Productos" placeholder="¿Qué productos ofrecés?" />

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Valor promedio"
          type="number"
          value={data.averageValue ?? ""}
          onChange={(e) => onChange({ ...data, averageValue: Number(e.target.value) })}
        />
        <Select label="Moneda" value={data.currency ?? CURRENCY_OPTIONS[0]} onChange={(e) => onChange({ ...data, currency: e.target.value })}>
          {CURRENCY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <TextField data={data} onChange={onChange} field="benefits" label="Beneficios" />
      <TextField data={data} onChange={onChange} field="differentiators" label="Diferenciales" />
      <TextField data={data} onChange={onChange} field="successCases" label="Casos de éxito" />
      <TextField data={data} onChange={onChange} field="awards" label="Premios" />
      <TextField data={data} onChange={onChange} field="certifications" label="Certificaciones" />
    </div>
  );
}
