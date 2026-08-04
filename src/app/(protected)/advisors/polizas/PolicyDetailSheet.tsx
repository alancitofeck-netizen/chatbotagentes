"use client";

import { useEffect, useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { toast } from "@/components/toast/toast";
import { Download, Trash2, Upload, Plus } from "lucide-react";
import { uploadDocumentFile } from "@/lib/documents/uploadClient";
import { fileTypeMetaFor, formatFileSize } from "@/components/documents/documentIcons";
import type { DocumentItem } from "@/lib/documents/queries";
import { getDocumentsByRelatedAction, recordUploadedDocument, trashDocument, getDownloadUrl } from "@/lib/documents/actions";
import type { PolicyDetail, PolicyCoverage, PolicyActivityEntry } from "@/lib/policies/queries";
import {
  getPolicyByIdAction,
  getPolicyCoveragesAction,
  addPolicyCoverageAction,
  deletePolicyCoverageAction,
  getPolicyNotesAction,
  addPolicyNoteAction,
  getPolicyActivityAction,
} from "@/lib/policies/actions";
import { formatCurrency } from "@/lib/utils/format";

const INSURANCE_TYPE_LABEL: Record<string, string> = { auto: "Auto", hogar: "Hogar", vida: "Vida", otro: "Otro" };

function formatDateOnly(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function PolicyDetailSheet({
  policyId,
  onClose,
  onEdit,
  onDelete,
}: {
  policyId: string | null;
  onClose: () => void;
  onEdit: (policy: PolicyDetail) => void;
  onDelete: (policyId: string) => void;
}) {
  const [detail, setDetail] = useState<PolicyDetail | null>(null);
  const [tab, setTab] = useState("resumen");
  const [coverages, setCoverages] = useState<PolicyCoverage[]>([]);
  const [coveragesLoaded, setCoveragesLoaded] = useState(false);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [notes, setNotes] = useState<{ id: string; body: string; createdAt: string }[]>([]);
  const [notesLoaded, setNotesLoaded] = useState(false);
  const [activity, setActivity] = useState<PolicyActivityEntry[]>([]);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const [noteBody, setNoteBody] = useState("");
  const [newCoverageName, setNewCoverageName] = useState("");
  const [newCoverageSum, setNewCoverageSum] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!policyId) return;
    getPolicyByIdAction(policyId).then(setDetail);
  }, [policyId]);

  useEffect(() => {
    if (tab !== "coberturas" || coveragesLoaded || !policyId) return;
    getPolicyCoveragesAction(policyId).then((fresh) => {
      setCoverages(fresh);
      setCoveragesLoaded(true);
    });
  }, [tab, coveragesLoaded, policyId]);

  useEffect(() => {
    if (tab !== "documentos" || documentsLoaded || !policyId) return;
    getDocumentsByRelatedAction("policy", policyId).then((fresh) => {
      setDocuments(fresh);
      setDocumentsLoaded(true);
    });
  }, [tab, documentsLoaded, policyId]);

  useEffect(() => {
    if (tab !== "notas" || notesLoaded || !policyId) return;
    getPolicyNotesAction(policyId).then((fresh) => {
      setNotes(fresh);
      setNotesLoaded(true);
    });
  }, [tab, notesLoaded, policyId]);

  useEffect(() => {
    if (tab !== "timeline" || activityLoaded || !policyId) return;
    getPolicyActivityAction(policyId).then((fresh) => {
      setActivity(fresh);
      setActivityLoaded(true);
    });
  }, [tab, activityLoaded, policyId]);

  function handleAddNote() {
    if (!policyId || !noteBody.trim()) return;
    const body = noteBody.trim();
    setNoteBody("");
    startTransition(async () => {
      await addPolicyNoteAction(policyId, body);
      const fresh = await getPolicyNotesAction(policyId);
      setNotes(fresh);
      toast.success("Nota agregada.");
    });
  }

  function handleAddCoverage() {
    if (!policyId || !newCoverageName.trim()) return;
    startTransition(async () => {
      await addPolicyCoverageAction(policyId, {
        name: newCoverageName,
        sumInsured: newCoverageSum.trim() ? Number(newCoverageSum) : null,
        deductible: null,
        limitText: null,
        exclusions: null,
      });
      setNewCoverageName("");
      setNewCoverageSum("");
      const fresh = await getPolicyCoveragesAction(policyId);
      setCoverages(fresh);
      toast.success("Cobertura agregada.");
    });
  }

  function handleDeleteCoverage(coverageId: string) {
    if (!policyId) return;
    startTransition(async () => {
      await deletePolicyCoverageAction(coverageId);
      const fresh = await getPolicyCoveragesAction(policyId);
      setCoverages(fresh);
    });
  }

  async function handleUploadFiles(files: FileList | null) {
    if (!files || files.length === 0 || !policyId || !detail) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const documentId = crypto.randomUUID();
      const storagePath = `${detail.workspaceId}/${documentId}/${file.name}`;
      const uploaded = await uploadDocumentFile(storagePath, file);
      if (!uploaded) {
        toast.error(`No se pudo subir ${file.name}.`);
        continue;
      }
      try {
        await recordUploadedDocument({
          name: file.name,
          folderId: null,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          storagePath,
          relatedType: "policy",
          relatedId: policyId,
        });
      } catch {
        toast.error(`No se pudo registrar ${file.name}.`);
      }
    }
    const fresh = await getDocumentsByRelatedAction("policy", policyId);
    setDocuments(fresh);
    setUploading(false);
    toast.success("Archivo(s) subido(s).");
  }

  function handleDownload(documentId: string) {
    startTransition(async () => {
      const url = await getDownloadUrl(documentId);
      if (url) window.open(url, "_blank");
    });
  }

  function handleDeleteDocument(documentId: string) {
    if (!policyId) return;
    if (!window.confirm("¿Eliminar este archivo?")) return;
    startTransition(async () => {
      await trashDocument(documentId);
      const fresh = await getDocumentsByRelatedAction("policy", policyId);
      setDocuments(fresh);
    });
  }

  return (
    <Sheet open={policyId !== null} onClose={onClose} title={detail ? `${detail.company} — ${detail.contactName}` : "Póliza"}>
      {!detail ? (
        <div className="flex flex-col gap-3 p-5">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <div className="px-5 pt-4">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="coberturas">Coberturas</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
              <TabsTrigger value="notas">Notas</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
            </TabsList>

            <div className="py-4">
              <TabsContent value="resumen">
                <dl className="flex flex-col gap-3 text-sm">
                  {detail.policyNumber && (
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">N° de póliza</dt>
                      <dd className="font-mono text-foreground">{detail.policyNumber}</dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <dt className="text-neutral-500">Compañía</dt>
                    <dd className="text-foreground">{detail.company}</dd>
                  </div>
                  {detail.product && (
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Producto</dt>
                      <dd className="text-foreground">{detail.product}</dd>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <dt className="text-neutral-500">Tipo</dt>
                    <dd>
                      <Badge variant="accent">{INSURANCE_TYPE_LABEL[detail.insuranceType] ?? detail.insuranceType}</Badge>
                    </dd>
                  </div>
                  {detail.startDate && (
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Inicio de vigencia</dt>
                      <dd className="text-foreground">{formatDateOnly(detail.startDate)}</dd>
                    </div>
                  )}
                  {detail.endDate && (
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Vencimiento</dt>
                      <dd className="text-foreground">{formatDateOnly(detail.endDate)}</dd>
                    </div>
                  )}
                  {detail.premium !== null && (
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Prima</dt>
                      <dd className="font-mono font-semibold text-foreground">{formatCurrency(detail.premium, detail.premiumCurrency)}</dd>
                    </div>
                  )}
                  {detail.commissionAmount !== null && (
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Comisión</dt>
                      <dd className="font-mono text-foreground">{formatCurrency(detail.commissionAmount, detail.premiumCurrency)}</dd>
                    </div>
                  )}
                  {detail.sumInsured !== null && (
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Suma asegurada</dt>
                      <dd className="font-mono text-foreground">{formatCurrency(detail.sumInsured, detail.premiumCurrency)}</dd>
                    </div>
                  )}
                  <div className="my-1 h-px bg-border-default" />
                  <div className="flex items-center justify-between">
                    <dt className="text-neutral-500">Cliente</dt>
                    <dd className="text-foreground">{detail.contactName}</dd>
                  </div>
                  {detail.contactEmail && (
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Email</dt>
                      <dd className="truncate text-foreground">{detail.contactEmail}</dd>
                    </div>
                  )}
                  {detail.contactPhone && (
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Teléfono</dt>
                      <dd className="text-foreground">{detail.contactPhone}</dd>
                    </div>
                  )}
                  {detail.ownerName && (
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Agente responsable</dt>
                      <dd className="text-foreground">{detail.ownerName}</dd>
                    </div>
                  )}
                  {detail.source === "pdf_ai" && (
                    <div className="flex items-center justify-between">
                      <dt className="text-neutral-500">Origen</dt>
                      <dd>
                        <Badge variant="info">Creada con IA desde PDF</Badge>
                      </dd>
                    </div>
                  )}
                </dl>
                <div className="mt-4 flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => detail && onEdit(detail)}>
                    Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => detail && onDelete(detail.id)}>
                    Eliminar
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="coberturas">
                <div className="flex flex-col gap-3">
                  <div className="flex items-end gap-2">
                    <Input label="Nueva cobertura" value={newCoverageName} onChange={(e) => setNewCoverageName(e.target.value)} containerClassName="flex-1" />
                    <Input label="Suma" type="number" value={newCoverageSum} onChange={(e) => setNewCoverageSum(e.target.value)} containerClassName="w-28" />
                    <Button size="sm" onClick={handleAddCoverage} loading={isPending}>
                      <Plus className="size-4" aria-hidden="true" />
                    </Button>
                  </div>
                  {!coveragesLoaded ? (
                    <Skeleton className="h-16 w-full" />
                  ) : coverages.length === 0 ? (
                    <p className="text-sm text-neutral-500">Sin coberturas cargadas.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {coverages.map((c) => (
                        <li key={c.id} className="flex items-center gap-2 rounded-md bg-surface-2 p-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-foreground">{c.name}</p>
                            {c.sumInsured !== null && <p className="text-xs text-neutral-500">{formatCurrency(c.sumInsured, detail.premiumCurrency)}</p>}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteCoverage(c.id)}
                            className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong"
                            aria-label="Eliminar cobertura"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="documentos">
                <div className="flex flex-col gap-3">
                  <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border-strong bg-surface-2 p-4 text-sm text-neutral-500 hover:border-accent-500 hover:text-foreground">
                    <Upload size={16} aria-hidden="true" />
                    {uploading ? "Subiendo…" : "Subir archivo"}
                    <input type="file" multiple className="hidden" disabled={uploading} onChange={(e) => handleUploadFiles(e.target.files)} />
                  </label>
                  {!documentsLoaded ? (
                    <Skeleton className="h-16 w-full" />
                  ) : documents.length === 0 ? (
                    <p className="text-sm text-neutral-500">Sin archivos todavía.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {documents.map((doc) => {
                        const meta = fileTypeMetaFor(doc.name);
                        const Icon = meta.icon;
                        return (
                          <li key={doc.id} className="flex items-center gap-2 rounded-md bg-surface-2 p-3">
                            <Icon size={16} className={meta.color} aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm text-foreground">{doc.name}</p>
                              <p className="text-xs text-neutral-500">{formatFileSize(doc.sizeBytes)}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDownload(doc.id)}
                              className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground"
                              aria-label="Descargar"
                            >
                              <Download size={14} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong"
                              aria-label="Eliminar"
                            >
                              <Trash2 size={14} aria-hidden="true" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="notas">
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <input
                      value={noteBody}
                      onChange={(e) => setNoteBody(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddNote()}
                      placeholder="Agregar una nota…"
                      className="flex-1 rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
                    />
                    <Button size="sm" onClick={handleAddNote} loading={isPending}>
                      Agregar
                    </Button>
                  </div>
                  {!notesLoaded ? (
                    <Skeleton className="h-16 w-full" />
                  ) : notes.length === 0 ? (
                    <p className="text-sm text-neutral-500">Sin notas todavía.</p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {notes.map((note) => (
                        <li key={note.id} className="rounded-md bg-surface-2 p-3">
                          <p className="text-sm text-foreground">{note.body}</p>
                          <p className="mt-1 text-xs text-neutral-500">{formatDateTime(note.createdAt)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="timeline">
                {!activityLoaded ? (
                  <Skeleton className="h-16 w-full" />
                ) : activity.length === 0 ? (
                  <p className="text-sm text-neutral-500">Sin actividad todavía.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {activity.map((entry) => (
                      <li key={entry.id} className="flex flex-col gap-0.5 border-l-2 border-border-default pl-3">
                        <p className="text-sm text-foreground">{entry.action}</p>
                        <p className="text-xs text-neutral-500">
                          {entry.actorName ?? "Sistema"} · {formatDateTime(entry.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      )}
    </Sheet>
  );
}
