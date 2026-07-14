"use client";

import { useState, useTransition } from "react";
import { FileText, RefreshCw, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/toast/toast";
import type { KnowledgeBaseEntry } from "@/lib/ai-agents/queries";
import type { DocumentItem } from "@/lib/documents/queries";
import { getWorkspaceDocumentsForPickerAction, attachKnowledgeDocument, detachKnowledgeDocument, retryKnowledgeDocument } from "@/lib/ai-agents/actions";

const STATUS_VARIANT: Record<string, "neutral" | "success" | "warning" | "error"> = {
  pending: "warning",
  ready: "success",
  failed: "error",
};
const STATUS_LABEL: Record<string, string> = { pending: "Procesando…", ready: "Listo", failed: "Falló" };

const UNSUPPORTED_SOURCES = new Set(["google_docs", "google_sheets"]);

export function KnowledgeBaseTab({ agentId, initialEntries }: { agentId: string; initialEntries: KnowledgeBaseEntry[] }) {
  const [entries, setEntries] = useState(initialEntries);
  const [availableDocs, setAvailableDocs] = useState<DocumentItem[] | null>(null);
  const [selectedDocId, setSelectedDocId] = useState("");
  const [isPending, startTransition] = useTransition();

  function loadAvailableDocs() {
    startTransition(async () => {
      const docs = await getWorkspaceDocumentsForPickerAction();
      setAvailableDocs(docs.filter((d) => !entries.some((e) => e.documentId === d.id)));
    });
  }

  function handleAttach() {
    if (!selectedDocId) return;
    startTransition(async () => {
      try {
        await attachKnowledgeDocument(agentId, selectedDocId);
        toast.success("Documento asociado — procesando.");
        window.location.reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo asociar el documento.");
      }
    });
  }

  function handleRetry(documentId: string) {
    startTransition(async () => {
      try {
        await retryKnowledgeDocument(agentId, documentId);
        toast.success("Reprocesando…");
        window.location.reload();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo reprocesar.");
      }
    });
  }

  function handleDetach(documentId: string) {
    if (!window.confirm("¿Quitar este documento de la base de conocimiento del agente?")) return;
    startTransition(async () => {
      try {
        await detachKnowledgeDocument(agentId, documentId);
        setEntries((prev) => prev.filter((e) => e.documentId !== documentId));
        toast.success("Documento desasociado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo desasociar.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Asociar documento" />
        <p className="mb-3 text-sm text-neutral-500">
          El agente lee estos documentos al responder (PDF/TXT/CSV/MD). Google Docs/Sheets todavía no están soportados.
        </p>
        {availableDocs === null ? (
          <Button size="sm" variant="secondary" onClick={loadAvailableDocs} loading={isPending}>
            Elegir documento
          </Button>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <Select label="Documento" value={selectedDocId} onChange={(e) => setSelectedDocId(e.target.value)} containerClassName="min-w-[260px]">
              <option value="">Seleccioná uno…</option>
              {availableDocs.map((d) => (
                <option key={d.id} value={d.id} disabled={UNSUPPORTED_SOURCES.has(d.source)}>
                  {d.name}
                  {UNSUPPORTED_SOURCES.has(d.source) ? " (requiere Google Drive — próximamente)" : ""}
                </option>
              ))}
            </Select>
            <Button size="sm" onClick={handleAttach} loading={isPending} disabled={!selectedDocId}>
              Asociar
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Documentos asociados" />
        {entries.length === 0 ? (
          <p className="text-sm text-neutral-500">Sin documentos todavía.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {entries.map((e) => (
              <li key={e.documentId} className="flex items-center justify-between gap-3 rounded-md border border-border-default px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={16} className="shrink-0 text-neutral-400" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-foreground">{e.name}</p>
                    {e.error && <p className="truncate text-xs text-error-strong">{e.error}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={STATUS_VARIANT[e.status]}>{STATUS_LABEL[e.status]}</Badge>
                  {e.status === "failed" && (
                    <button type="button" title="Reintentar" onClick={() => handleRetry(e.documentId)} className="text-neutral-400 hover:text-foreground">
                      <RefreshCw size={14} aria-hidden="true" />
                    </button>
                  )}
                  <button type="button" title="Quitar" onClick={() => handleDetach(e.documentId)} className="text-neutral-400 hover:text-error-strong">
                    <Trash2 size={14} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
