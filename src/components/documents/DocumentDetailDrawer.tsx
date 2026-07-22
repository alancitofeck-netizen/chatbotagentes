"use client";

import { useState, useTransition } from "react";
import { Download, User, Users, Calendar, HardDrive, X, ExternalLink, RefreshCw } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Avatar } from "@/components/ui/Avatar";
import { toast } from "@/components/toast/toast";
import { cn } from "@/lib/utils/cn";
import { fileTypeMetaFor, formatFileSize } from "@/components/documents/documentIcons";
import { GoogleDriveFolderPickerDialog } from "@/components/documents/GoogleDriveFolderPickerDialog";
import type { DocumentItem } from "@/lib/documents/queries";
import { deleteDocumentPermanently, getDownloadUrl, renameDocument, shareDocument, trashDocument, unshareDocument } from "@/lib/documents/actions";
import { exportDocumentToDriveAction, refreshDocumentFromDriveAction } from "@/lib/documents/googleDriveImport";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Row({ icon: Icon, label, children }: { icon: typeof User; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-neutral-500">
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 pt-1 text-sm">
        <p className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</p>
        <div className="text-foreground">{children}</div>
      </div>
    </div>
  );
}

interface MemberOption {
  memberId: string;
  fullName: string;
}

export function DocumentDetailDrawer({
  document,
  members,
  ownMemberId,
  onClose,
  onChanged,
}: {
  document: DocumentItem;
  members: MemberOption[];
  ownMemberId: string | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const meta = fileTypeMetaFor(document.name);
  const Icon = meta.icon;
  const [shareMemberId, setShareMemberId] = useState("");
  const [shareRole, setShareRole] = useState<"viewer" | "editor">("viewer");
  const [exportOpen, setExportOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const shareableMembers = members.filter(
    (m) => m.memberId !== ownMemberId && !document.sharedWith.some((s) => s.memberId === m.memberId),
  );

  function handleDownload() {
    startTransition(async () => {
      const url = await getDownloadUrl(document.id);
      if (url) window.open(url, "_blank");
      else toast.error("No se pudo generar el link de descarga.");
    });
  }

  function handleRename() {
    const name = window.prompt("Nuevo nombre:", document.name);
    if (!name?.trim() || name === document.name) return;
    startTransition(async () => {
      await renameDocument(document.id, name.trim());
      onChanged();
    });
  }

  function handleTrash() {
    startTransition(async () => {
      await trashDocument(document.id);
      toast.success("Enviado a la papelera.");
      onClose();
    });
  }

  function handleDeleteForever() {
    if (!window.confirm(`¿Eliminar "${document.name}" definitivamente? Esta acción no se puede deshacer.`)) return;
    startTransition(async () => {
      await deleteDocumentPermanently(document.id);
      toast.success("Eliminado definitivamente.");
      onClose();
    });
  }

  function handleShare() {
    if (!shareMemberId) return;
    startTransition(async () => {
      await shareDocument(document.id, shareMemberId, shareRole);
      setShareMemberId("");
      toast.success("Documento compartido.");
      onChanged();
    });
  }

  function handleUnshare(memberId: string) {
    startTransition(async () => {
      await unshareDocument(document.id, memberId);
      onChanged();
    });
  }

  function handleRefreshFromDrive() {
    startTransition(async () => {
      try {
        await refreshDocumentFromDriveAction(document.id);
        toast.success("Actualizado desde Google Drive.");
        onChanged();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo actualizar desde Google Drive.");
      }
    });
  }

  async function handleExportPicked(folderId: string | null, folderName: string) {
    setExportOpen(false);
    try {
      const result = await exportDocumentToDriveAction(document.id, folderId);
      toast.success(`Exportado a "${folderName}" en Google Drive.`);
      if (result.webViewLink) window.open(result.webViewLink, "_blank");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo exportar a Google Drive.");
    }
  }

  return (
    <Sheet open onClose={onClose} title={document.name} className="max-w-lg">
      <div className="flex flex-col gap-5 p-5">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-12 items-center justify-center rounded-xl bg-surface-2", meta.color)}>
            <Icon size={24} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-foreground">{document.name}</p>
            <p className="text-[12.5px] text-neutral-500">
              {meta.label} · {formatFileSize(document.sizeBytes)}
            </p>
          </div>
        </div>

        <Row icon={User} label="Propietario">
          {document.owner ? (
            <div className="flex items-center gap-2">
              <Avatar name={document.owner.fullName} size={22} />
              {document.owner.fullName}
            </div>
          ) : (
            "—"
          )}
        </Row>

        <Row icon={Calendar} label="Creado / modificado">
          <p>{formatDateTime(document.createdAt)}</p>
          {document.lastModifiedBy && <p className="text-[12.5px] text-neutral-500">Última edición: {document.lastModifiedBy.fullName}</p>}
        </Row>

        <Row icon={HardDrive} label="Origen">
          {document.source === "upload" ? (
            "Subido manualmente"
          ) : document.source === "google_drive" ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span>Importado de Google Drive</span>
                {document.externalUrl && (
                  <a href={document.externalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] text-accent-600 hover:underline">
                    Ver en Drive <ExternalLink size={12} aria-hidden="true" />
                  </a>
                )}
              </div>
              {document.externalMetadata?.owners && document.externalMetadata.owners.length > 0 && (
                <p className="text-[12.5px] text-neutral-500">Propietario en Drive: {document.externalMetadata.owners.join(", ")}</p>
              )}
              <button
                type="button"
                onClick={handleRefreshFromDrive}
                disabled={isPending}
                className="inline-flex w-fit items-center gap-1 text-[12.5px] text-accent-600 hover:underline disabled:opacity-50"
              >
                <RefreshCw size={12} aria-hidden="true" /> Actualizar desde Drive
              </button>
            </div>
          ) : (
            document.source
          )}
        </Row>

        <Row icon={Users} label="Compartido con">
          <div className="flex flex-col gap-2">
            {document.sharedWith.length === 0 ? (
              <p className="text-[12.5px] text-neutral-500">Todo el workspace puede ver este documento. Nadie tiene edición exclusiva todavía.</p>
            ) : (
              document.sharedWith.map((s) => (
                <div key={s.memberId} className="flex items-center justify-between gap-2 rounded-md bg-surface-2 px-2.5 py-1.5">
                  <div className="flex items-center gap-2 text-[13px]">
                    <Avatar name={s.fullName} size={20} />
                    {s.fullName}
                    <span className="text-[11px] text-neutral-400">{s.role === "editor" ? "Editor" : "Solo lectura"}</span>
                  </div>
                  <button type="button" onClick={() => handleUnshare(s.memberId)} className="text-neutral-400 hover:text-error-strong">
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              ))
            )}
            {shareableMembers.length > 0 && (
              <div className="flex gap-2">
                <Select label="" value={shareMemberId} onChange={(e) => setShareMemberId(e.target.value)} containerClassName="flex-1">
                  <option value="">Agregar persona…</option>
                  {shareableMembers.map((m) => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.fullName}
                    </option>
                  ))}
                </Select>
                <Select label="" value={shareRole} onChange={(e) => setShareRole(e.target.value as "viewer" | "editor")} containerClassName="w-28">
                  <option value="viewer">Lectura</option>
                  <option value="editor">Editor</option>
                </Select>
                <Button size="sm" onClick={handleShare} disabled={!shareMemberId || isPending}>
                  Agregar
                </Button>
              </div>
            )}
          </div>
        </Row>

        <div className="mt-2 flex flex-wrap justify-end gap-2 border-t border-border-default pt-4">
          <Button type="button" variant="destructive" onClick={document.isTrashed ? handleDeleteForever : handleTrash} disabled={isPending}>
            {document.isTrashed ? "Eliminar definitivamente" : "Eliminar"}
          </Button>
          <Button type="button" variant="secondary" onClick={handleRename} disabled={isPending}>
            Renombrar
          </Button>
          <Button type="button" variant="secondary" onClick={() => setExportOpen(true)} disabled={isPending}>
            <HardDrive size={14} aria-hidden="true" />
            Exportar a Drive
          </Button>
          <Button type="button" onClick={handleDownload} loading={isPending}>
            <Download size={14} aria-hidden="true" />
            Descargar
          </Button>
        </div>
      </div>

      {exportOpen && <GoogleDriveFolderPickerDialog onClose={() => setExportOpen(false)} onPick={handleExportPicked} />}
    </Sheet>
  );
}
