"use client";

import { useState } from "react";
import { Folder as FolderIcon, MoreVertical, Pencil, FolderInput, Copy, Share2, Trash2, RotateCcw, XCircle, Star, HardDrive } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { toast } from "@/components/toast/toast";
import { cn } from "@/lib/utils/cn";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { fileTypeMetaFor, formatFileSize } from "@/components/documents/documentIcons";
import { GoogleDriveFolderPickerDialog } from "@/components/documents/GoogleDriveFolderPickerDialog";
import type { DocumentItem, DocumentView, FolderNode } from "@/lib/documents/queries";
import {
  deleteDocumentPermanently,
  deleteFolder,
  duplicateDocument,
  moveDocument,
  moveFolder,
  renameDocument,
  renameFolder,
  restoreDocument,
  toggleFavorite,
  trashDocument,
} from "@/lib/documents/actions";
import { exportDocumentToDriveAction } from "@/lib/documents/googleDriveImport";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

/** Small Sheet-based folder picker for "Mover" — a flat list is enough for
 * this pass (no drag handles/nested picker), click a row to move there. */
function MoveDialog({
  folders,
  onClose,
  onPick,
}: {
  folders: FolderNode[];
  onClose: () => void;
  onPick: (folderId: string | null) => void;
}) {
  return (
    <Sheet open onClose={onClose} title="Mover a…" className="max-w-sm">
      <div className="flex flex-col p-2">
        <button type="button" onClick={() => onPick(null)} className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2">
          <FolderIcon size={15} className="text-neutral-400" aria-hidden="true" />
          Raíz (Todos los documentos)
        </button>
        {folders.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onPick(f.id)}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2"
          >
            <FolderIcon size={15} className="text-neutral-400" aria-hidden="true" />
            {f.name}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function FolderCard({
  folder,
  layout,
  allFolders,
  onOpen,
  onChanged,
}: {
  folder: FolderNode;
  layout: "grid" | "list";
  allFolders: FolderNode[];
  onOpen: () => void;
  onChanged: () => void;
}) {
  const [moveOpen, setMoveOpen] = useState(false);

  async function handleRename() {
    const name = window.prompt("Nuevo nombre de la carpeta:", folder.name);
    if (!name?.trim() || name === folder.name) return;
    try {
      await renameFolder(folder.id, name.trim());
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo renombrar.");
    }
  }

  async function handleDelete() {
    if (!window.confirm(`¿Eliminar la carpeta "${folder.name}"? Los documentos adentro pasan a la papelera.`)) return;
    try {
      await deleteFolder(folder.id);
      toast.success("Carpeta eliminada.");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  const menuItems = [
    { label: "Renombrar", icon: <Pencil size={14} />, onSelect: handleRename },
    { label: "Mover", icon: <FolderInput size={14} />, onSelect: () => setMoveOpen(true) },
    { label: "Eliminar", icon: <Trash2 size={14} />, destructive: true, onSelect: handleDelete },
  ];

  if (layout === "list") {
    return (
      <>
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border-default hover:bg-surface-1 hover:shadow-[var(--elevation-xs)]"
        >
          <FolderIcon size={18} className="shrink-0 text-accent-500" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{folder.name}</span>
          <span className="w-24 shrink-0 text-xs text-neutral-400">Carpeta</span>
          <DropdownMenu trigger={<MoreVertical size={15} />} triggerLabel="Más opciones" items={menuItems} />
        </button>
        {moveOpen && (
          <MoveDialog
            folders={allFolders.filter((f) => f.id !== folder.id)}
            onClose={() => setMoveOpen(false)}
            onPick={async (targetId) => {
              setMoveOpen(false);
              await moveFolder(folder.id, targetId);
              onChanged();
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="group relative flex flex-col gap-2 rounded-xl border border-border-default bg-surface-1 p-4 shadow-[var(--elevation-xs)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[var(--elevation-sm)]">
        <button type="button" onClick={onOpen} className="flex flex-col items-start gap-3 text-left">
          <FolderIcon size={28} className="text-accent-500" aria-hidden="true" />
          <span className="line-clamp-2 text-[13px] font-medium text-foreground">{folder.name}</span>
        </button>
        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
          <DropdownMenu trigger={<MoreVertical size={15} />} triggerLabel="Más opciones" items={menuItems} />
        </div>
      </div>
      {moveOpen && (
        <MoveDialog
          folders={allFolders.filter((f) => f.id !== folder.id)}
          onClose={() => setMoveOpen(false)}
          onPick={async (targetId) => {
            setMoveOpen(false);
            await moveFolder(folder.id, targetId);
            onChanged();
          }}
        />
      )}
    </>
  );
}

function DocumentCard({
  document,
  layout,
  folders,
  view,
  onOpen,
  onChanged,
}: {
  document: DocumentItem;
  layout: "grid" | "list";
  folders: FolderNode[];
  view: DocumentView;
  onOpen: () => void;
  onChanged: () => void;
}) {
  const [moveOpen, setMoveOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const meta = fileTypeMetaFor(document.name);
  const Icon = meta.icon;

  async function handleRename() {
    const name = window.prompt("Nuevo nombre:", document.name);
    if (!name?.trim() || name === document.name) return;
    try {
      await renameDocument(document.id, name.trim());
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo renombrar.");
    }
  }

  async function handleDuplicate() {
    try {
      await duplicateDocument(document.id);
      toast.success("Documento duplicado.");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo duplicar.");
    }
  }

  async function handleTrash() {
    await trashDocument(document.id);
    toast.success("Enviado a la papelera.");
    onChanged();
  }

  async function handleRestore() {
    await restoreDocument(document.id);
    toast.success("Documento restaurado.");
    onChanged();
  }

  async function handleDeleteForever() {
    if (!window.confirm(`¿Eliminar "${document.name}" definitivamente? Esta acción no se puede deshacer.`)) return;
    await deleteDocumentPermanently(document.id);
    toast.success("Eliminado definitivamente.");
    onChanged();
  }

  async function handleToggleFavorite() {
    await toggleFavorite(document.id, !document.isFavorite);
    onChanged();
  }

  async function handleExportPicked(folderId: string | null, folderName: string) {
    setExportOpen(false);
    try {
      const result = await exportDocumentToDriveAction(document.id, folderId);
      toast.success(`«${document.name}» exportado a "${folderName}" en Google Drive.`);
      if (result.webViewLink) window.open(result.webViewLink, "_blank");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo exportar a Google Drive.");
    }
  }

  const menuItems =
    view === "trash"
      ? [
          { label: "Restaurar", icon: <RotateCcw size={14} />, onSelect: handleRestore },
          { label: "Eliminar definitivamente", icon: <XCircle size={14} />, destructive: true, onSelect: handleDeleteForever },
        ]
      : [
          { label: "Renombrar", icon: <Pencil size={14} />, onSelect: handleRename },
          { label: "Mover", icon: <FolderInput size={14} />, onSelect: () => setMoveOpen(true) },
          { label: "Duplicar", icon: <Copy size={14} />, onSelect: handleDuplicate },
          { label: "Compartir", icon: <Share2 size={14} />, onSelect: onOpen },
          { label: "Exportar a Google Drive", icon: <HardDrive size={14} />, onSelect: () => setExportOpen(true) },
          { label: document.isFavorite ? "Quitar de favoritos" : "Marcar favorito", icon: <Star size={14} />, onSelect: handleToggleFavorite },
          { label: "Eliminar", icon: <Trash2 size={14} />, destructive: true, onSelect: handleTrash },
        ];

  if (layout === "list") {
    return (
      <>
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border-default hover:bg-surface-1 hover:shadow-[var(--elevation-xs)]"
        >
          <Icon size={18} className={cn("shrink-0", meta.color)} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{document.name}</span>
          {document.isFavorite && <Star size={13} className="shrink-0 fill-warning text-warning" aria-hidden="true" />}
          <span className="w-20 shrink-0 text-xs text-neutral-400">{meta.label}</span>
          <span className="w-16 shrink-0 text-xs text-neutral-400">{formatFileSize(document.sizeBytes)}</span>
          <span className="w-24 shrink-0 text-xs text-neutral-400">{formatDate(document.updatedAt)}</span>
          <span className="w-28 shrink-0 truncate text-xs text-neutral-400">{document.owner?.fullName ?? "—"}</span>
          <DropdownMenu trigger={<MoreVertical size={15} />} triggerLabel="Más opciones" items={menuItems} />
        </button>
        {moveOpen && (
          <MoveDialog
            folders={folders}
            onClose={() => setMoveOpen(false)}
            onPick={async (targetId) => {
              setMoveOpen(false);
              await moveDocument(document.id, targetId);
              onChanged();
            }}
          />
        )}
        {exportOpen && <GoogleDriveFolderPickerDialog onClose={() => setExportOpen(false)} onPick={handleExportPicked} />}
      </>
    );
  }

  return (
    <>
      <div className="group relative flex flex-col gap-2 rounded-xl border border-border-default bg-surface-1 p-4 shadow-[var(--elevation-xs)] transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[var(--elevation-sm)]">
        <button type="button" onClick={onOpen} className="flex flex-col items-start gap-3 text-left">
          <Icon size={28} className={meta.color} aria-hidden="true" />
          <span className="line-clamp-2 text-[13px] font-medium text-foreground">{document.name}</span>
          <span className="text-[11px] text-neutral-400">
            {formatFileSize(document.sizeBytes)} · {formatDate(document.updatedAt)}
          </span>
        </button>
        {document.isFavorite && <Star size={13} className="absolute left-3 top-3 fill-warning text-warning" aria-hidden="true" />}
        <div className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100">
          <DropdownMenu trigger={<MoreVertical size={15} />} triggerLabel="Más opciones" items={menuItems} />
        </div>
      </div>
      {moveOpen && (
        <MoveDialog
          folders={folders}
          onClose={() => setMoveOpen(false)}
          onPick={async (targetId) => {
            setMoveOpen(false);
            await moveDocument(document.id, targetId);
            onChanged();
          }}
        />
      )}
      {exportOpen && <GoogleDriveFolderPickerDialog onClose={() => setExportOpen(false)} onPick={handleExportPicked} />}
    </>
  );
}

export function DocumentsGrid({
  layout,
  view,
  documents,
  folders,
  onOpenFolder,
  onOpenDocument,
  onChanged,
}: {
  layout: "grid" | "list";
  view: DocumentView;
  documents: DocumentItem[];
  folders: FolderNode[];
  onOpenFolder: (id: string) => void;
  onOpenDocument: (id: string) => void;
  onChanged: () => void;
}) {
  if (layout === "list") {
    return (
      <div className="flex flex-col gap-1">
        {folders.map((f) => (
          <FolderCard key={f.id} folder={f} layout="list" allFolders={folders} onOpen={() => onOpenFolder(f.id)} onChanged={onChanged} />
        ))}
        {documents.map((d) => (
          <DocumentCard key={d.id} document={d} layout="list" folders={folders} view={view} onOpen={() => onOpenDocument(d.id)} onChanged={onChanged} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {folders.map((f) => (
        <FolderCard key={f.id} folder={f} layout="grid" allFolders={folders} onOpen={() => onOpenFolder(f.id)} onChanged={onChanged} />
      ))}
      {documents.map((d) => (
        <DocumentCard key={d.id} document={d} layout="grid" folders={folders} view={view} onOpen={() => onOpenDocument(d.id)} onChanged={onChanged} />
      ))}
    </div>
  );
}
