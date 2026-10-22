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
import { Download, Trash2, Upload, MessageCircle, Mail, Copy, ShieldCheck } from "lucide-react";
import type { CollectionItem, CollectionActivityEntry } from "@/lib/collections/queries";
import { deriveCollectionBucket, COLLECTION_BUCKET_LABEL, COLLECTION_BUCKET_VARIANT, PAYMENT_METHODS } from "@/lib/collections/constants";
import {
  getCollectionByIdAction,
  getCollectionActivityAction,
  registerPaymentAction,
  rescheduleCollectionAction,
  cancelCollectionAction,
  deleteCollectionAction,
  generateCollectionMessageAction,
} from "@/lib/collections/actions";
import { uploadDocumentFile } from "@/lib/documents/uploadClient";
import { fileTypeMetaFor, formatFileSize } from "@/components/documents/documentIcons";
import type { DocumentItem } from "@/lib/documents/queries";
import { getDocumentsByRelatedAction, recordUploadedDocument, trashDocument, getDownloadUrl } from "@/lib/documents/actions";
import { formatCurrency } from "@/lib/utils/format";

function formatDateOnly(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

type Tab = "info" | "documentos" | "historial";

export function CollectionDetailDrawer({
  paymentId,
  onClose,
  onChanged,
}: {
  paymentId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [item, setItem] = useState<CollectionItem | null>(null);
  const [tab, setTab] = useState<Tab>("info");
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [documentsLoaded, setDocumentsLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [activity, setActivity] = useState<CollectionActivityEntry[]>([]);
  const [activityLoaded, setActivityLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [reference, setReference] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [registering, setRegistering] = useState(false);
  const [newDueDate, setNewDueDate] = useState("");
  const [rescheduling, setRescheduling] = useState(false);
  const [generatingChannel, setGeneratingChannel] = useState<"email" | "whatsapp" | null>(null);
  const [generatedMessage, setGeneratedMessage] = useState<{ channel: "email" | "whatsapp"; text: string } | null>(null);

  useEffect(() => {
    if (!paymentId) return;
    Promise.resolve().then(() => {
      setTab("info");
      setDocumentsLoaded(false);
      setActivityLoaded(false);
      setGeneratedMessage(null);
    });
    getCollectionByIdAction(paymentId).then((fresh) => {
      setItem(fresh);
      setNewDueDate(fresh?.dueDate ?? "");
    });
  }, [paymentId]);

  useEffect(() => {
    if (tab !== "documentos" || documentsLoaded || !paymentId) return;
    getDocumentsByRelatedAction("policy_payment", paymentId).then((fresh) => {
      setDocuments(fresh);
      setDocumentsLoaded(true);
    });
  }, [tab, documentsLoaded, paymentId]);

  useEffect(() => {
    if (tab !== "historial" || activityLoaded || !paymentId) return;
    getCollectionActivityAction(paymentId).then((fresh) => {
      setActivity(fresh);
      setActivityLoaded(true);
    });
  }, [tab, activityLoaded, paymentId]);

  async function refresh() {
    if (!paymentId) return;
    const fresh = await getCollectionByIdAction(paymentId);
    setItem(fresh);
    onChanged();
  }

  async function handleUploadFiles(files: FileList | null) {
    if (!files || files.length === 0 || !paymentId) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const documentId = crypto.randomUUID();
      const storagePath = `${documentId}/${file.name}`;
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
          relatedType: "policy_payment",
          relatedId: paymentId,
        });
      } catch {
        toast.error(`No se pudo registrar ${file.name}.`);
      }
    }
    const fresh = await getDocumentsByRelatedAction("policy_payment", paymentId);
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
    if (!paymentId) return;
    if (!window.confirm("¿Eliminar este archivo?")) return;
    startTransition(async () => {
      await trashDocument(documentId);
      const fresh = await getDocumentsByRelatedAction("policy_payment", paymentId);
      setDocuments(fresh);
    });
  }

  async function handleRegisterPayment() {
    if (!paymentId) return;
    setRegistering(true);
    try {
      await registerPaymentAction(paymentId, { paymentMethod, reference, receiptNumber });
      toast.success("Pago registrado.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo registrar el pago.");
    } finally {
      setRegistering(false);
    }
  }

  async function handleReschedule() {
    if (!paymentId || !newDueDate) return;
    setRescheduling(true);
    try {
      await rescheduleCollectionAction(paymentId, newDueDate);
      toast.success("Cobro reprogramado.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo reprogramar.");
    } finally {
      setRescheduling(false);
    }
  }

  async function handleCancel() {
    if (!paymentId) return;
    if (!window.confirm("¿Cancelar este cobro?")) return;
    try {
      await cancelCollectionAction(paymentId);
      toast.success("Cobro cancelado.");
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cancelar.");
    }
  }

  async function handleDelete() {
    if (!paymentId) return;
    if (!window.confirm("¿Eliminar este cobro? Esta acción no se puede deshacer.")) return;
    try {
      await deleteCollectionAction(paymentId);
      toast.success("Cobro eliminado.");
      onChanged();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  function handleGenerate(channel: "email" | "whatsapp") {
    if (!paymentId) return;
    setGeneratingChannel(channel);
    setGeneratedMessage(null);
    generateCollectionMessageAction(paymentId, channel)
      .then((result) => {
        if (typeof result !== "string") {
          toast.error(result.error);
          return;
        }
        setGeneratedMessage({ channel, text: result });
      })
      .catch((err) => toast.error(err instanceof Error ? err.message : "No se pudo generar el mensaje."))
      .finally(() => setGeneratingChannel(null));
  }

  const bucket = item ? deriveCollectionBucket(item.status, item.dueDate) : null;
  const isOpen = item ? item.status === "pendiente" || item.status === "en_seguimiento" : false;

  return (
    <Sheet open={Boolean(paymentId)} onClose={onClose} title={item?.contactName ?? "Cobro"}>
      {!item ? (
        <div className="flex flex-col gap-3 p-5">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-3 border-b border-border-default px-5 py-3">
            <div>
              <p className="text-sm text-neutral-500">
                {item.company}
                {item.policyNumber ? ` · ${item.policyNumber}` : ""}
              </p>
              <p className="font-mono text-lg font-semibold text-foreground">{formatCurrency(item.amount, item.currency)}</p>
            </div>
            {bucket && <Badge variant={COLLECTION_BUCKET_VARIANT[bucket]}>{COLLECTION_BUCKET_LABEL[bucket]}</Badge>}
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="flex flex-1 flex-col">
            <TabsList className="px-5">
              <TabsTrigger value="info">Info</TabsTrigger>
              <TabsTrigger value="documentos">Archivos</TabsTrigger>
              <TabsTrigger value="historial">Historial</TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto p-5">
              <TabsContent value="info">
                <div className="flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-neutral-500">Cliente</p>
                      <p className="text-foreground">{item.contactName}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Ejecutivo</p>
                      <p className="text-foreground">{item.ownerName ?? "Sin asignar"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Vencimiento</p>
                      <p className="text-foreground">{formatDateOnly(item.dueDate)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-neutral-500">Emisión</p>
                      <p className="text-foreground">{item.issueDate ? formatDateOnly(item.issueDate) : "—"}</p>
                    </div>
                    {item.status === "pagado" && (
                      <>
                        <div>
                          <p className="text-xs text-neutral-500">Pagado el</p>
                          <p className="text-foreground">{item.paidAt ? formatDateTime(item.paidAt) : "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-500">Método</p>
                          <p className="text-foreground">{item.paymentMethod ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-500">Recibo</p>
                          <p className="text-foreground">{item.receiptNumber ?? "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-neutral-500">Referencia</p>
                          <p className="text-foreground">{item.reference ?? "—"}</p>
                        </div>
                      </>
                    )}
                  </div>

                  {item.notes && (
                    <div>
                      <p className="text-xs text-neutral-500">Notas</p>
                      <p className="text-sm text-foreground">{item.notes}</p>
                    </div>
                  )}

                  {isOpen && (
                    <>
                      <div className="flex flex-col gap-2 rounded-lg border border-border-default p-4">
                        <p className="text-sm font-medium text-foreground">Registrar pago</p>
                        <Select label="Método de pago" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </Select>
                        <div className="flex gap-2">
                          <Input label="N° de recibo" value={receiptNumber} onChange={(e) => setReceiptNumber(e.target.value)} containerClassName="flex-1" />
                          <Input label="Referencia" value={reference} onChange={(e) => setReference(e.target.value)} containerClassName="flex-1" />
                        </div>
                        <Button onClick={handleRegisterPayment} loading={registering}>
                          <ShieldCheck className="size-4" aria-hidden="true" />
                          Marcar como pagado
                        </Button>
                      </div>

                      <div className="flex flex-col gap-2 rounded-lg border border-border-default p-4">
                        <p className="text-sm font-medium text-foreground">Reprogramar</p>
                        <div className="flex items-end gap-2">
                          <Input label="Nuevo vencimiento" type="date" value={newDueDate} onChange={(e) => setNewDueDate(e.target.value)} containerClassName="flex-1" />
                          <Button variant="secondary" onClick={handleReschedule} loading={rescheduling}>
                            Guardar
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 rounded-lg border border-border-default p-4">
                        <p className="text-sm font-medium text-foreground">Mensaje de recordatorio (IA)</p>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="secondary" onClick={() => handleGenerate("whatsapp")} loading={generatingChannel === "whatsapp"}>
                            <MessageCircle className="size-4" aria-hidden="true" />
                            WhatsApp
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => handleGenerate("email")} loading={generatingChannel === "email"}>
                            <Mail className="size-4" aria-hidden="true" />
                            Email
                          </Button>
                        </div>
                        {generatedMessage && (
                          <div className="flex flex-col gap-2 rounded-md bg-surface-2 p-3">
                            <p className="whitespace-pre-wrap text-xs text-foreground">{generatedMessage.text}</p>
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(generatedMessage.text);
                                toast.success("Mensaje copiado.");
                              }}
                              className="inline-flex w-fit items-center gap-1.5 text-xs font-medium text-accent-700 hover:text-accent-800"
                            >
                              <Copy className="size-3.5" aria-hidden="true" />
                              Copiar
                            </button>
                          </div>
                        )}
                      </div>

                      <Button variant="destructive" onClick={handleCancel}>
                        Cancelar cobro
                      </Button>
                    </>
                  )}

                  <Button variant="ghost" onClick={handleDelete}>
                    <Trash2 className="size-4" aria-hidden="true" />
                    Eliminar cobro
                  </Button>
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
                              className="flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground"
                              aria-label="Descargar"
                              disabled={isPending}
                            >
                              <Download size={14} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDocument(doc.id)}
                              className="flex size-7 shrink-0 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong"
                              aria-label="Eliminar"
                              disabled={isPending}
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

              <TabsContent value="historial">
                <div className="flex flex-col gap-3">
                  {!activityLoaded ? (
                    <Skeleton className="h-16 w-full" />
                  ) : activity.length === 0 ? (
                    <p className="text-sm text-neutral-500">Sin actividad registrada todavía.</p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {activity.map((entry) => (
                        <li key={entry.id} className="flex flex-col gap-0.5 border-l-2 border-border-default pl-3">
                          <p className="text-sm text-foreground">{entry.action}</p>
                          <p className="text-xs text-neutral-500">
                            {formatDateTime(entry.createdAt)}
                            {entry.actorName ? ` · ${entry.actorName}` : ""}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      )}
    </Sheet>
  );
}
