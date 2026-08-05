"use client";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { QuestionField } from "@/lib/advisorySessions/constants";

/** Renderizador genérico de preguntas — reusado por Perfil, Descubrimiento y
 * las preguntas específicas de cada Ramo, así el esquema de campos
 * (constants.ts) es la única fuente de verdad y agregar/editar una
 * pregunta no toca ningún componente de paso. */
export function DynamicQuestionForm({
  fields,
  data,
  onChange,
  columns = 2,
}: {
  fields: QuestionField[];
  data: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  columns?: 1 | 2;
}) {
  function setField(key: string, value: unknown) {
    onChange({ ...data, [key]: value });
  }

  return (
    <div className={`grid grid-cols-1 gap-4 ${columns === 2 ? "sm:grid-cols-2" : ""}`}>
      {fields.map((field) => {
        const value = data[field.key];

        if (field.type === "boolean") {
          return (
            <label key={field.key} className="flex items-center gap-2.5 rounded-lg border border-border-default bg-surface-1 px-4 py-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => setField(field.key, e.target.checked)}
                className="size-4 rounded accent-accent-600"
              />
              {field.label}
            </label>
          );
        }

        if (field.type === "select") {
          return (
            <Select key={field.key} label={field.label} value={(value as string) ?? ""} onChange={(e) => setField(field.key, e.target.value)}>
              <option value="">Sin especificar</option>
              {(field.options ?? []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </Select>
          );
        }

        if (field.type === "textarea") {
          return (
            <label key={field.key} className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-sm font-medium text-foreground">{field.label}</span>
              <textarea
                value={(value as string) ?? ""}
                onChange={(e) => setField(field.key, e.target.value)}
                placeholder={field.placeholder}
                rows={3}
                className="rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
              />
            </label>
          );
        }

        return (
          <Input
            key={field.key}
            label={field.label}
            type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
            value={(value as string | number | undefined) ?? ""}
            onChange={(e) => setField(field.key, field.type === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
            placeholder={field.placeholder}
          />
        );
      })}
    </div>
  );
}
