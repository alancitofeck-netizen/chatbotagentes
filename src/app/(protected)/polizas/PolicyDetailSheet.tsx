"use client";

import { useEffect, useState, useTransition } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { toast } from "@/components/toast/toast";
import { Download, Trash2, Upload, Plus, Sparkles, Copy, Mail, MessageCircle, Loader2, CalendarRange, Check, Scale, History } from "lucide-react";
import { PolicyCompareSheet } from "./PolicyCompareSheet";
import { uploadDocumentFile } from "@/lib/documents/uploadClient";
import { fileTypeMetaFor, formatFileSize } from "@/components/documents/documentIcons";
import type { DocumentItem, DocumentVersion } from "@/lib/documents/queries";
import {
  getDocumentsByRelatedAction,
  recordUploadedDocument,
  trashDocument,
  getDownloadUrl,
  getDocumentVersionsAction,
  uploadNewDocumentVersionAction,
} from "@/lib/documents/actions";
import type { PolicyDetail, PolicyCoverage, PolicyActivityEntry, PolicyPayment, PolicyPaymentStatus, PolicyEndorsement } from "@/lib/policies/queries";
import { POLICY_DOCUMENT_CATEGORIES, POLICY_ENDORSEMENT_TYPES, type PolicyDocumentCategory } from "@/lib/policies/constants";
import type { PolicyAnalysis } from "@/lib/policies/aiAnalysis";
import {
  getPolicyByIdAction,
  getPolicyCoveragesAction,
  addPolicyCoverageAction,
  deletePolicyCoverageAction,
  getPolicyNotesAction,
  addPolicyNoteAction,
  getPolicyActivityAction,
  analyzePolicyAction,
  generateRenewalMessageAction,
  getPolicyPaymentsAction,
  generatePolicyPaymentScheduleAction,
  addPolicyPaymentAction,
  updatePolicyPaymentStatusAction,
  deletePolicyPaymentAction,
  getPolicyEndorsementsAction,
  addPolicyEndorsementAction,
  deletePolicyEndorsementAction,
} from "@/lib/policies/actions";
import { formatCurrency } from "@/lib/utils/format";

const ENDORSEMENT_TYPE_LABEL = new Map<string, string>(POLICY_ENDORSEMENT_TYPES.map((t) => [t.key, t.label]));

const PAYMENT_STATUS_VARIANT: Record<PolicyPaymentStatus, "success" | "warning" | "error"> = { pagado: "success", pendiente: "warning", vencido: "error" };
const PAYMENT_STATUS_LABEL: Record<PolicyPaymentStatus, string> = { pagado: "Pagado", pendiente: "Pendiente", vencido: "Vencido" };

const CATEGORY_LABEL_BY_KEY = new Map<string, string>(POLICY_DOCUMENT_CATEGORIES.map((c) => [c.key, c.label]));

const INSURANCE_TYPE_LABEL: Record<string, string> = { auto: "Auto", hogar: "Hogar", vida: "Vida", otro: "Otro" };

function formatDateOnly(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export type DetailTab = "resumen" | "coberturas" | "documentos" | "pagos" | "endosos" | "notas" | "timeline" | "ia";

export function PolicyDetailSheet({
  policyId,
  initialTab = "resumen",
  onClose,
  onEdit,
  onDelete,
}: {
  policyId: string | null;
  /** Lets a caller (e.g. PolicyTable's "Adjuntar documentos" row action)
   * jump straight to a tab instead of always landing on Resumen — same
   * pattern as CRM's CardDetailSheet. */
  initialTab?: DetailTab;
  onClose: () => void;
  onEdit: (policy: PolicyDetail) => void;
  onDelete: (policyId: string) => void;
}) {
  const [detail, setDetail] = useState<PolicyDetail | null>(null);
  const [tab, setTab] = useState(initialTab);
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
  const [uploadCategory, setUploadCategory] = useState<PolicyDocumentCategory>("poliza_pdf");
  const [analysis, setAnalysis] = useState<PolicyAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState<{ channel: "email" | "whatsapp"; text: string } | null>(null);
  const [generatingChannel, setGeneratingChannel] = useState<"email" | "whatsapp" | null>(null);
  const [payments, setPayments] = useState<PolicyPayment[]>([]);
  const [paymentsLoaded, setPaymentsLoaded] = useState(false);
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [newPaymentDate, setNewPaymentDate] = useState("");
  const [newPaymentAmount, setNewPaymentAmount] = useState("");
  const [endorsements, setEndorsements] = useState<PolicyEndorsement[]>([]);
  const [endorsementsLoaded, setEndorsementsLoaded] = useState(false);
  const [newEndorsementDate, setNewEndorsementDate] = useState("");
  const [newEndorsementType, setNewEndorsementType] = useState<string>(POLICY_ENDORSEMENT_TYPES[0].key);
  const [newEndorsementDescription, setNewEndorsementDescription] = useState("");
  const [compareOpen, setCompareOpen] = useState(false);
  const [versionsOpenFor, setVersionsOpenFor] = useState<string | null>(null);
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [uploadingVersionFor, setUploadingVersionFor] = useState<string | null>(null);
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

  useEffect(() => {
    if (tab !== "pagos" || paymentsLoaded || !policyId) return;
    getPolicyPaymentsAction(policyId).then((fresh) => {
      setPayments(fresh);
      setPaymentsLoaded(true);
    });
  }, [tab, paymentsLoaded, policyId]);

  useEffect(() => {
    if (tab !== "endosos" || endorsementsLoaded || !policyId) return;
    getPolicyEndorsementsAction(policyId).then((fresh) => {
      setEndorsements(fresh);
      setEndorsementsLoaded(true);
    });
  }, [tab, endorsementsLoaded, policyId]);

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
          docCategory: uploadCategory,
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

  function handleToggleVersions(documentId: string) {
    if (versionsOpenFor === documentId) {
      setVersionsOpenFor(null);
      return;
    }
    setVersionsOpenFor(documentId);
    getDocumentVersionsAction(documentId).then(setVersions);
  }

  async function handleUploadNewVersion(documentId: string, file: File | undefined) {
    if (!file || !detail) return;
    setUploadingVersionFor(documentId);
    try {
      const storagePath = `${detail.workspaceId}/${documentId}/v${crypto.randomUUID()}-${file.name}`;
      const uploaded = await uploadDocumentFile(storagePath, file);
      if (!uploaded) throw new Error("No se pudo subir el archivo.");
      await uploadNewDocumentVersionAction(documentId, storagePath, file.size);
      if (policyId) {
        const fresh = await getDocumentsByRelatedAction("policy", policyId);
        setDocuments(fresh);
      }
      if (versionsOpenFor === documentId) getDocumentVersionsAction(documentId).then(setVersions);
      toast.success("Nueva versión subida.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la nueva versión.");
    } finally {
      setUploadingVersionFor(null);
    }
  }

  function handleAnalyze() {
    if (!policyId) return;
    setAnalyzing(true);
    setAnalysis(null);
    analyzePolicyAction(policyId)
      .then(setAnalysis)
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo analizar la póliza."))
      .finally(() => setAnalyzing(false));
  }

  function handleGenerateMessage(channel: "email" | "whatsapp") {
    if (!policyId) return;
    setGeneratingChannel(channel);
    setGeneratedMessage(null);
    generateRenewalMessageAction(policyId, channel)
      .then((text) => setGeneratedMessage({ channel, text }))
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo generar el mensaje."))
      .finally(() => setGeneratingChannel(null));
  }

  function handleCopyMessage() {
    if (!generatedMessage) return;
    navigator.clipboard.writeText(generatedMessage.text);
    toast.success("Copiado al portapapeles.");
  }

  function handleGenerateSchedule() {
    if (!policyId) return;
    setGeneratingSchedule(true);
    generatePolicyPaymentScheduleAction(policyId)
      .then((fresh) => {
        setPayments(fresh);
        toast.success("Cronograma generado.");
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo generar el cronograma."))
      .finally(() => setGeneratingSchedule(false));
  }

  function handleAddPayment() {
    if (!policyId || !newPaymentDate || !newPaymentAmount.trim() || !detail) return;
    startTransition(async () => {
      await addPolicyPaymentAction(policyId, { dueDate: newPaymentDate, amount: Number(newPaymentAmount), currency: detail.premiumCurrency });
      setNewPaymentDate("");
      setNewPaymentAmount("");
      const fresh = await getPolicyPaymentsAction(policyId);
      setPayments(fresh);
      toast.success("Cuota agregada.");
    });
  }

  function handleTogglePaymentStatus(payment: PolicyPayment) {
    if (!policyId) return;
    const nextStatus: PolicyPaymentStatus = payment.status === "pagado" ? "pendiente" : "pagado";
    startTransition(async () => {
      await updatePolicyPaymentStatusAction(payment.id, nextStatus);
      const fresh = await getPolicyPaymentsAction(policyId);
      setPayments(fresh);
    });
  }

  function handleDeletePayment(paymentId: string) {
    if (!policyId) return;
    startTransition(async () => {
      await deletePolicyPaymentAction(paymentId);
      const fresh = await getPolicyPaymentsAction(policyId);
      setPayments(fresh);
    });
  }

  function handleAddEndorsement() {
    if (!policyId || !newEndorsementDate || !newEndorsementDescription.trim()) return;
    startTransition(async () => {
      try {
        await addPolicyEndorsementAction(policyId, { endorsementDate: newEndorsementDate, type: newEndorsementType, description: newEndorsementDescription });
        setNewEndorsementDate("");
        setNewEndorsementDescription("");
        const fresh = await getPolicyEndorsementsAction(policyId);
        setEndorsements(fresh);
        toast.success("Endoso registrado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo registrar el endoso.");
      }
    });
  }

  function handleDeleteEndorsement(endorsementId: string) {
    if (!policyId) return;
    startTransition(async () => {
      await deletePolicyEndorsementAction(endorsementId);
      const fresh = await getPolicyEndorsementsAction(policyId);
      setEndorsements(fresh);
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
          <Tabs value={tab} onValueChange={(v) => setTab(v as DetailTab)}>
            <TabsList>
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="coberturas">Coberturas</TabsTrigger>
              <TabsTrigger value="documentos">Documentos</TabsTrigger>
              <TabsTrigger value="pagos">Pagos</TabsTrigger>
              <TabsTrigger value="endosos">Endosos</TabsTrigger>
              <TabsTrigger value="notas">Notas</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="ia">IA</TabsTrigger>
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
                  <Button variant="secondary" size="sm" onClick={() => setCompareOpen(true)}>
                    <Scale className="size-4" aria-hidden="true" />
                    Comparar
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
                  <div className="flex items-end gap-2">
                    <Select
                      label="Categoría del archivo a subir"
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value as PolicyDocumentCategory)}
                      containerClassName="flex-1"
                    >
                      {POLICY_DOCUMENT_CATEGORIES.map((c) => (
                        <option key={c.key} value={c.key}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                  </div>
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
                    (() => {
                      const groups = new Map<string, DocumentItem[]>();
                      for (const doc of documents) {
                        const key = doc.docCategory && CATEGORY_LABEL_BY_KEY.has(doc.docCategory) ? doc.docCategory : "sin_categoria";
                        groups.set(key, [...(groups.get(key) ?? []), doc]);
                      }
                      const orderedKeys = [...POLICY_DOCUMENT_CATEGORIES.map((c) => c.key), "sin_categoria"].filter((k) => groups.has(k));
                      return (
                        <div className="flex flex-col gap-4">
                          {orderedKeys.map((key) => (
                            <div key={key} className="flex flex-col gap-2">
                              <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">
                                {CATEGORY_LABEL_BY_KEY.get(key) ?? "Sin categoría"}
                              </p>
                              <ul className="flex flex-col gap-2">
                                {groups.get(key)!.map((doc) => {
                                  const meta = fileTypeMetaFor(doc.name);
                                  const Icon = meta.icon;
                                  return (
                                    <li key={doc.id} className="flex flex-col gap-2 rounded-md bg-surface-2 p-3">
                                      <div className="flex items-center gap-2">
                                        <Icon size={16} className={meta.color} aria-hidden="true" />
                                        <div className="min-w-0 flex-1">
                                          <p className="truncate text-sm text-foreground">{doc.name}</p>
                                          <p className="text-xs text-neutral-500">{formatFileSize(doc.sizeBytes)}</p>
                                        </div>
                                        <label
                                          className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground"
                                          title="Subir nueva versión"
                                        >
                                          {uploadingVersionFor === doc.id ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Upload size={14} aria-hidden="true" />}
                                          <input
                                            type="file"
                                            className="hidden"
                                            disabled={uploadingVersionFor === doc.id}
                                            onChange={(e) => handleUploadNewVersion(doc.id, e.target.files?.[0])}
                                          />
                                        </label>
                                        <button
                                          type="button"
                                          onClick={() => handleToggleVersions(doc.id)}
                                          className="flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground"
                                          aria-label="Ver versiones anteriores"
                                          title="Versiones anteriores"
                                        >
                                          <History size={14} aria-hidden="true" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDownload(doc.id)}
                                          className="flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground"
                                          aria-label="Descargar"
                                        >
                                          <Download size={14} aria-hidden="true" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteDocument(doc.id)}
                                          className="flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong"
                                          aria-label="Eliminar"
                                        >
                                          <Trash2 size={14} aria-hidden="true" />
                                        </button>
                                      </div>
                                      {versionsOpenFor === doc.id && (
                                        <ul className="flex flex-col gap-1 border-t border-border-default pt-2">
                                          {versions.length === 0 ? (
                                            <li className="text-xs text-neutral-500">Sin versiones anteriores — esta es la única.</li>
                                          ) : (
                                            versions.map((v) => (
                                              <li key={v.id} className="flex items-center justify-between text-xs text-neutral-500">
                                                <span>
                                                  v{v.versionNumber} · {formatFileSize(v.sizeBytes)} {v.createdByName ? `· ${v.createdByName}` : ""}
                                                </span>
                                                <span>{formatDateTime(v.createdAt)}</span>
                                              </li>
                                            ))
                                          )}
                                        </ul>
                                      )}
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ))}
                        </div>
                      );
                    })()
                  )}
                </div>
              </TabsContent>

              <TabsContent value="pagos">
                <div className="flex flex-col gap-3">
                  {payments.length === 0 && paymentsLoaded && (
                    <Button size="sm" variant="secondary" onClick={handleGenerateSchedule} loading={generatingSchedule}>
                      <CalendarRange className="size-4" aria-hidden="true" />
                      Generar cronograma según frecuencia de pago
                    </Button>
                  )}

                  <div className="flex items-end gap-2">
                    <Input label="Vencimiento" type="date" value={newPaymentDate} onChange={(e) => setNewPaymentDate(e.target.value)} containerClassName="flex-1" />
                    <Input label="Monto" type="number" value={newPaymentAmount} onChange={(e) => setNewPaymentAmount(e.target.value)} containerClassName="w-28" />
                    <Button size="sm" onClick={handleAddPayment} loading={isPending}>
                      <Plus className="size-4" aria-hidden="true" />
                    </Button>
                  </div>

                  {!paymentsLoaded ? (
                    <Skeleton className="h-16 w-full" />
                  ) : payments.length === 0 ? (
                    <p className="text-sm text-neutral-500">Sin cuotas cargadas.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {payments.map((p) => {
                        // "Vencido" se calcula acá, no se persiste — evita
                        // tener que sincronizar un cron aparte solo para
                        // esto; el badge simplemente refleja la fecha actual.
                        const displayStatus: PolicyPaymentStatus = p.status === "pendiente" && p.dueDate < new Date().toISOString().slice(0, 10) ? "vencido" : p.status;
                        return (
                          <li key={p.id} className="flex items-center gap-2 rounded-md bg-surface-2 p-3">
                            <button
                              type="button"
                              onClick={() => handleTogglePaymentStatus(p)}
                              className={`flex size-7 shrink-0 items-center justify-center rounded-full border ${p.status === "pagado" ? "border-success-strong bg-success-bg text-success-strong" : "border-border-strong text-neutral-400 hover:text-foreground"}`}
                              aria-label={p.status === "pagado" ? "Marcar como pendiente" : "Marcar como pagada"}
                            >
                              <Check size={14} aria-hidden="true" />
                            </button>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-foreground">{formatDateOnly(p.dueDate)}</p>
                              <p className="text-xs text-neutral-500">{formatCurrency(p.amount, p.currency)}</p>
                            </div>
                            <Badge variant={PAYMENT_STATUS_VARIANT[displayStatus]}>{PAYMENT_STATUS_LABEL[displayStatus]}</Badge>
                            <button
                              type="button"
                              onClick={() => handleDeletePayment(p.id)}
                              className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong"
                              aria-label="Eliminar cuota"
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

              <TabsContent value="endosos">
                <div className="flex flex-col gap-3">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input label="Fecha" type="date" value={newEndorsementDate} onChange={(e) => setNewEndorsementDate(e.target.value)} />
                    <Select label="Tipo" value={newEndorsementType} onChange={(e) => setNewEndorsementType(e.target.value)}>
                      {POLICY_ENDORSEMENT_TYPES.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <label className="flex flex-1 flex-col gap-1.5">
                      <span className="text-sm font-medium text-foreground">Descripción</span>
                      <input
                        value={newEndorsementDescription}
                        onChange={(e) => setNewEndorsementDescription(e.target.value)}
                        placeholder="Ej. Se agrega a Juan Pérez como beneficiario secundario…"
                        className="rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
                      />
                    </label>
                    <Button size="sm" onClick={handleAddEndorsement} loading={isPending}>
                      <Plus className="size-4" aria-hidden="true" />
                    </Button>
                  </div>

                  {!endorsementsLoaded ? (
                    <Skeleton className="h-16 w-full" />
                  ) : endorsements.length === 0 ? (
                    <p className="text-sm text-neutral-500">Sin endosos registrados.</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {endorsements.map((e) => (
                        <li key={e.id} className="flex flex-col gap-1 rounded-md bg-surface-2 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <Badge variant="info">{ENDORSEMENT_TYPE_LABEL.get(e.type) ?? e.type}</Badge>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-neutral-500">{formatDateOnly(e.endorsementDate)}</span>
                              <button
                                type="button"
                                onClick={() => handleDeleteEndorsement(e.id)}
                                className="flex size-6 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong"
                                aria-label="Eliminar endoso"
                              >
                                <Trash2 size={12} aria-hidden="true" />
                              </button>
                            </div>
                          </div>
                          <p className="text-sm text-foreground">{e.description}</p>
                          {e.createdByName && <p className="text-xs text-neutral-500">Registrado por {e.createdByName}</p>}
                        </li>
                      ))}
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
                        <p className="text-sm text-foreground">
                          {entry.action}
                          {typeof entry.metadata.rule === "string" ? ` — ${entry.metadata.rule}` : ""}
                          {typeof entry.metadata.stage === "string" ? ` — ${entry.metadata.stage}` : ""}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {entry.actorName ?? "Sistema"} · {formatDateTime(entry.createdAt)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="ia">
                <div className="flex flex-col gap-4">
                  {!analysis && !analyzing && (
                    <div className="flex flex-col items-center gap-3 rounded-md bg-surface-2 p-6 text-center">
                      <Sparkles className="size-6 text-accent-500" aria-hidden="true" />
                      <p className="text-sm text-neutral-500">Resumen, coberturas explicadas, riesgos detectados y sugerencias de venta cruzada, generados a partir de los datos reales de esta póliza.</p>
                      <Button onClick={handleAnalyze}>
                        <Sparkles className="size-4" aria-hidden="true" />
                        Analizar con IA
                      </Button>
                    </div>
                  )}

                  {analyzing && (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                      <Loader2 className="size-6 animate-spin text-accent-500" aria-hidden="true" />
                      <p className="text-sm text-neutral-500">Analizando…</p>
                    </div>
                  )}

                  {analysis && (
                    <>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Resumen</p>
                        <p className="mt-1 text-sm text-foreground">{analysis.summary}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Coberturas</p>
                        <p className="mt-1 text-sm text-foreground">{analysis.coverageExplanation}</p>
                      </div>
                      {analysis.risks.length > 0 && (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Riesgos detectados</p>
                          <ul className="mt-1 flex flex-col gap-1">
                            {analysis.risks.map((r, i) => (
                              <li key={i} className="rounded-md bg-warning-bg p-2 text-sm text-warning-strong">
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {analysis.crossSellSuggestions.length > 0 && (
                        <div>
                          <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Oportunidades de venta cruzada</p>
                          <ul className="mt-1 flex flex-col gap-2">
                            {analysis.crossSellSuggestions.map((s, i) => (
                              <li key={i} className="rounded-md bg-surface-2 p-3">
                                <p className="text-sm font-medium text-foreground">{s.product}</p>
                                <p className="text-xs text-neutral-500">{s.reason}</p>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Renovación</p>
                        <p className="mt-1 text-sm text-foreground">{analysis.renewalSuggestion}</p>
                      </div>
                      <Button variant="secondary" size="sm" onClick={handleAnalyze}>
                        Volver a analizar
                      </Button>
                    </>
                  )}

                  <div className="my-1 h-px bg-border-default" />
                  <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Generar mensaje de renovación</p>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => handleGenerateMessage("email")} loading={generatingChannel === "email"}>
                      <Mail className="size-4" aria-hidden="true" />
                      Email
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => handleGenerateMessage("whatsapp")} loading={generatingChannel === "whatsapp"}>
                      <MessageCircle className="size-4" aria-hidden="true" />
                      WhatsApp
                    </Button>
                  </div>
                  {generatedMessage && (
                    <div className="flex flex-col gap-2">
                      <textarea
                        readOnly
                        value={generatedMessage.text}
                        rows={6}
                        className="rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none"
                      />
                      <div className="flex gap-2">
                        <Button size="sm" variant="secondary" onClick={handleCopyMessage}>
                          <Copy className="size-4" aria-hidden="true" />
                          Copiar
                        </Button>
                        {generatedMessage.channel === "whatsapp" && detail.contactPhone && (
                          <Button
                            size="sm"
                            onClick={() =>
                              window.open(
                                `https://wa.me/${detail.contactPhone!.replace(/\D/g, "")}?text=${encodeURIComponent(generatedMessage.text)}`,
                                "_blank",
                                "noopener,noreferrer",
                              )
                            }
                          >
                            <MessageCircle className="size-4" aria-hidden="true" />
                            Abrir en WhatsApp
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      )}
      <PolicyCompareSheet open={compareOpen} onClose={() => setCompareOpen(false)} initialPolicyId={policyId} />
    </Sheet>
  );
}
