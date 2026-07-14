"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { importOpportunitiesCsv, type ImportLeadRow } from "@/lib/crm/actions";

const EXPECTED_HEADER = ["name", "phone", "email", "company", "source", "value", "priority"];
const SAMPLE = "name,phone,email,company,source,value,priority\nNombre Apellido,+5491100000000,correo@empresa.com,Nombre de la empresa,LinkedIn,5000,high";

/** Minimal, hand-rolled CSV parser for this fixed column format — not a
 * generic CSV engine (no new dependency added), just quote-aware enough for
 * company names with commas in them. */
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  function splitLine(line: string): string[] {
    const fields: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current);
    return fields.map((f) => f.trim());
  }

  const header = splitLine(lines[0]).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const values = splitLine(line);
    const row: Record<string, string> = {};
    header.forEach((key, i) => {
      row[key] = values[i] ?? "";
    });
    return row;
  });
}

export function ImportLeadsSheet({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<ImportLeadRow[] | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: { row: number; reason: string }[] } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handlePreview() {
    const rows = parseCsv(text);
    if (rows.length === 0) {
      toast.error("No se encontraron filas válidas. Revisá el formato del CSV.");
      return;
    }
    setPreview(
      rows.map((r) => ({
        name: r.name ?? "",
        phone: r.phone ?? "",
        email: r.email ?? "",
        company: r.company ?? "",
        source: r.source ?? "",
        value: r.value ?? "",
        priority: r.priority ?? "",
      })),
    );
    setResult(null);
  }

  function handleConfirm() {
    if (!preview) return;
    startTransition(async () => {
      const res = await importOpportunitiesCsv(preview);
      setResult(res);
      if (res.imported > 0) toast.success(`${res.imported} lead(s) importado(s).`);
      if (res.skipped.length > 0) toast.error(`${res.skipped.length} fila(s) omitida(s). Ver detalle abajo.`);
      onImported();
    });
  }

  return (
    <Sheet open onClose={onClose} title="Importar leads">
      <div className="flex flex-col gap-4 p-5">
        <p className="text-sm text-neutral-500">
          Pegá un CSV con columnas <code className="rounded bg-surface-2 px-1 py-0.5 text-xs">{EXPECTED_HEADER.join(", ")}</code>. Nombre y
          teléfono son obligatorios.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={SAMPLE}
          rows={8}
          className="rounded-sm border border-border-strong bg-surface-1 px-3 py-2 font-mono text-xs text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />
        <Button variant="secondary" onClick={handlePreview} type="button">
          Previsualizar
        </Button>

        {preview && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">{preview.length} fila(s) detectadas</p>
            <div className="max-h-52 overflow-y-auto rounded-md border border-border-default">
              <table className="w-full text-xs">
                <thead className="bg-surface-2 text-neutral-500">
                  <tr>
                    <th className="px-2 py-1.5 text-left">Nombre</th>
                    <th className="px-2 py-1.5 text-left">Teléfono</th>
                    <th className="px-2 py-1.5 text-left">Empresa</th>
                    <th className="px-2 py-1.5 text-left">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} className="border-t border-border-default">
                      <td className="px-2 py-1.5">{r.name || "—"}</td>
                      <td className="px-2 py-1.5">{r.phone || "—"}</td>
                      <td className="px-2 py-1.5">{r.company || "—"}</td>
                      <td className="px-2 py-1.5">{r.value || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button onClick={handleConfirm} loading={isPending}>
              Confirmar importación
            </Button>
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-2 rounded-md bg-surface-2 p-3 text-sm">
            <p className="font-medium text-foreground">{result.imported} importado(s)</p>
            {result.skipped.length > 0 && (
              <ul className="flex flex-col gap-1 text-xs text-error-strong">
                {result.skipped.map((s) => (
                  <li key={s.row}>
                    Fila {s.row}: {s.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
