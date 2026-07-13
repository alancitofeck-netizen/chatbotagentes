"use client";

import { useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { parseImportFile, importContactsFromRows, type ContactColumnMapping, type ParsedImportFile } from "@/lib/documents/import";

const CONTACT_FIELDS: { key: keyof ContactColumnMapping; label: string; required?: boolean }[] = [
  { key: "name", label: "Nombre", required: true },
  { key: "phone", label: "WhatsApp / Teléfono" },
  { key: "email", label: "Email" },
  { key: "company", label: "Empresa" },
  { key: "title", label: "Cargo" },
  { key: "notes", label: "Notas" },
];

type Step = "upload" | "map" | "preview";

/** Generic column-mapping importer — only Contactos is wired to a real
 * target this pass (the concrete example given: Nombre/Email/WhatsApp/
 * Empresa/Cargo/Notas). The entity selector below is left in place so
 * Tareas/Oportunidades can be added later without rebuilding the wizard. */
export function ImportWizard({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParsedImportFile | null>(null);
  const [mapping, setMapping] = useState<ContactColumnMapping>({ name: null, phone: null, email: null, company: null, title: null, notes: null });
  const [result, setResult] = useState<{ imported: number; skipped: { row: number; reason: string }[] } | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    startTransition(async () => {
      try {
        const fresh = await parseImportFile(formData);
        if (fresh.rows.length === 0) {
          toast.error("No se encontraron filas en el archivo.");
          return;
        }
        setParsed(fresh);
        // Best-effort auto-map by matching header names.
        const auto: ContactColumnMapping = { name: null, phone: null, email: null, company: null, title: null, notes: null };
        for (const header of fresh.headers) {
          const h = header.toLowerCase();
          if (!auto.name && /nombre|name/.test(h)) auto.name = header;
          else if (!auto.phone && /whatsapp|tel|phone/.test(h)) auto.phone = header;
          else if (!auto.email && /email|correo/.test(h)) auto.email = header;
          else if (!auto.company && /empresa|company/.test(h)) auto.company = header;
          else if (!auto.title && /cargo|title|puesto/.test(h)) auto.title = header;
          else if (!auto.notes && /nota|note/.test(h)) auto.notes = header;
        }
        setMapping(auto);
        setStep("map");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo leer el archivo.");
      }
    });
  }

  function handleConfirm() {
    if (!parsed) return;
    startTransition(async () => {
      const res = await importContactsFromRows(parsed.rows, mapping);
      setResult(res);
      setStep("preview");
      if (res.imported > 0) toast.success(`${res.imported} contacto(s) importado(s).`);
      if (res.skipped.length > 0) toast.error(`${res.skipped.length} fila(s) omitida(s).`);
      onImported();
    });
  }

  return (
    <Sheet open onClose={onClose} title="Importar contactos" className="max-w-xl">
      <div className="flex flex-col gap-4 p-5">
        {step === "upload" && (
          <>
            <p className="text-sm text-neutral-500">Subí un archivo CSV o Excel (.xlsx) con tus contactos.</p>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border-strong p-8 text-center hover:bg-surface-2">
              <span className="text-sm font-medium text-foreground">Hacé clic para elegir un archivo</span>
              <span className="text-xs text-neutral-400">.csv o .xlsx</span>
              <input
                type="file"
                accept=".csv,.xlsx"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
            {isPending && <p className="text-sm text-neutral-500">Leyendo archivo…</p>}
          </>
        )}

        {step === "map" && parsed && (
          <>
            <p className="text-sm text-neutral-500">
              {parsed.rows.length} fila(s) detectadas. Elegí qué columna de tu archivo corresponde a cada campo.
            </p>
            <div className="flex flex-col gap-3">
              {CONTACT_FIELDS.map((field) => (
                <Select
                  key={field.key}
                  label={`${field.label}${field.required ? " *" : ""}`}
                  value={mapping[field.key] ?? ""}
                  onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value || null }))}
                >
                  <option value="">Sin mapear</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </Select>
              ))}
            </div>

            <div className="max-h-48 overflow-y-auto rounded-md border border-border-default">
              <table className="w-full text-xs">
                <thead className="bg-surface-2 text-neutral-500">
                  <tr>
                    {CONTACT_FIELDS.map((f) => (
                      <th key={f.key} className="px-2 py-1.5 text-left">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-t border-border-default">
                      {CONTACT_FIELDS.map((f) => (
                        <td key={f.key} className="px-2 py-1.5">
                          {mapping[f.key] ? (row[mapping[f.key]!] ?? "—") : "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setStep("upload")}>
                Atrás
              </Button>
              <Button onClick={handleConfirm} loading={isPending} disabled={!mapping.name}>
                Previsualizar e importar
              </Button>
            </div>
          </>
        )}

        {step === "preview" && result && (
          <div className="flex flex-col gap-3">
            <div className="rounded-md bg-surface-2 p-3 text-sm">
              <p className="font-medium text-foreground">{result.imported} contacto(s) importado(s)</p>
              {result.skipped.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1 text-xs text-error-strong">
                  {result.skipped.map((s) => (
                    <li key={s.row}>
                      Fila {s.row}: {s.reason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Button onClick={onClose}>Cerrar</Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
