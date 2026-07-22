"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Folder as FolderIcon,
  Search,
  FileIcon,
  MoreVertical,
  ExternalLink,
  Eye,
  Link2,
  Download,
  Share2,
  FileUp,
  Star,
} from "lucide-react";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { toast } from "@/components/toast/toast";
import { cn } from "@/lib/utils/cn";
import type { DriveFileWithStatus } from "@/lib/documents/googleDriveImport";
import {
  listGoogleDriveFilesAction,
  importSingleDriveFileAction,
  toggleDriveFileFavoriteAction,
} from "@/lib/documents/googleDriveImport";
import { GoogleDrivePreviewDrawer } from "./GoogleDrivePreviewDrawer";

interface FolderCrumb {
  id: string | null;
  name: string;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

function formatSize(bytes: number | null) {
  if (bytes === null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Persistent "Google Drive" tab inside Documentos — browse/search Drive's
 * own folder hierarchy (independent of the CRM's `folders` table), preview,
 * and import/favorite/share/download/copy-link individual files. Replaces
 * the earlier one-shot import modal: this is always live (every navigation
 * re-lists straight from the Drive API, so there's nothing here to go
 * stale), matching the explicit "pestañas dentro de Documentos, no un
 * módulo nuevo" ask. List-row layout only (not grid+list like the CRM tab)
 * — proportionate for a browse-and-act view where the per-row action menu
 * is the main interaction, not thumbnails. */
export function GoogleDriveBrowser() {
  const [crumbs, setCrumbs] = useState<FolderCrumb[]>([{ id: null, name: "Mi unidad" }]);
  const [files, setFiles] = useState<DriveFileWithStatus[]>([]);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [previewFile, setPreviewFile] = useState<DriveFileWithStatus | null>(null);
  const [isLoading, startLoading] = useTransition();
  const [pendingFileId, setPendingFileId] = useState<string | null>(null);

  function load(folderId: string | null, searchTerm?: string) {
    startLoading(async () => {
      try {
        const result = await listGoogleDriveFilesAction({ folderId, search: searchTerm });
        setFiles(result);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo listar Google Drive.");
      }
    });
  }

  useEffect(() => {
    load(null);
  }, []);

  function openFolder(file: DriveFileWithStatus) {
    setCrumbs((prev) => [...prev, { id: file.id, name: file.name }]);
    setSearch("");
    setSearching(false);
    load(file.id);
  }

  function goToCrumb(index: number) {
    setCrumbs((prev) => prev.slice(0, index + 1));
    setSearch("");
    setSearching(false);
    load(crumbs[index].id);
  }

  function handleSearch() {
    if (!search.trim()) return;
    setSearching(true);
    load(null, search);
  }

  function patchFile(fileId: string, patch: Partial<DriveFileWithStatus>) {
    setFiles((prev) => prev.map((f) => (f.id === fileId ? { ...f, ...patch } : f)));
  }

  async function handleImport(file: DriveFileWithStatus) {
    if (file.documentId) {
      toast.success("Ya estaba importado a Documentos.");
      return;
    }
    setPendingFileId(file.id);
    try {
      const { documentId } = await importSingleDriveFileAction(file.id, null);
      patchFile(file.id, { documentId });
      toast.success(`«${file.name}» importado a Documentos.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo importar.");
    } finally {
      setPendingFileId(null);
    }
  }

  async function handleToggleFavorite(file: DriveFileWithStatus) {
    setPendingFileId(file.id);
    try {
      const next = !file.isFavorite;
      const { documentId } = await toggleDriveFileFavoriteAction(file.id, null, next);
      patchFile(file.id, { documentId, isFavorite: next });
      toast.success(next ? "Marcado como favorito." : "Quitado de favoritos.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar favoritos.");
    } finally {
      setPendingFileId(null);
    }
  }

  function handleCopyLink(file: DriveFileWithStatus) {
    if (!file.webViewLink) {
      toast.error("Este archivo no tiene un enlace disponible.");
      return;
    }
    navigator.clipboard.writeText(file.webViewLink);
    toast.success("Enlace copiado.");
  }

  function handleDownload(file: DriveFileWithStatus) {
    window.open(`/api/integrations/google-drive/download?fileId=${encodeURIComponent(file.id)}`, "_blank");
  }

  function handleShare(file: DriveFileWithStatus) {
    if (file.webViewLink) window.open(file.webViewLink, "_blank");
  }

  const folders = files.filter((f) => f.isFolder);
  const documents = files.filter((f) => !f.isFolder);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default px-6 py-4">
        <div className="relative w-64">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Buscar en Google Drive…"
            className="w-full rounded-full border border-border-strong bg-surface-1 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 px-6 pt-3 text-[13px] text-neutral-500">
        {searching ? (
          <button type="button" onClick={() => goToCrumb(crumbs.length - 1)} className="text-accent-600 hover:underline">
            ← Volver a la navegación de carpetas
          </button>
        ) : (
          crumbs.map((c, i) => (
            <span key={c.id ?? "root"} className="flex items-center gap-1">
              {i > 0 && <span>/</span>}
              <button type="button" onClick={() => goToCrumb(i)} className="hover:text-foreground hover:underline">
                {c.name}
              </button>
            </span>
          ))
        )}
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {isLoading ? (
          <p className="text-sm text-neutral-500">Cargando…</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-neutral-500">{searching ? "Sin resultados." : "Esta carpeta está vacía."}</p>
        ) : (
          <div className="flex flex-col gap-1">
            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => openFolder(f)}
                className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left transition-colors hover:border-border-default hover:bg-surface-1 hover:shadow-[var(--elevation-xs)]"
              >
                <FolderIcon size={18} className="shrink-0 text-accent-500" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{f.name}</span>
                <span className="w-24 shrink-0 text-xs text-neutral-400">Carpeta</span>
              </button>
            ))}

            {documents.map((f) => {
              const menuItems = [
                { label: "Abrir en Drive", icon: <ExternalLink size={14} />, onSelect: () => f.webViewLink && window.open(f.webViewLink, "_blank"), disabled: !f.webViewLink },
                { label: "Vista previa", icon: <Eye size={14} />, onSelect: () => setPreviewFile(f) },
                { label: "Copiar enlace", icon: <Link2 size={14} />, onSelect: () => handleCopyLink(f) },
                { label: "Descargar", icon: <Download size={14} />, onSelect: () => handleDownload(f) },
                { label: "Compartir", icon: <Share2 size={14} />, onSelect: () => handleShare(f), disabled: !f.webViewLink },
                {
                  label: f.documentId ? "Ya importado" : "Importar a Documentos",
                  icon: <FileUp size={14} />,
                  onSelect: () => handleImport(f),
                  disabled: Boolean(f.documentId) || pendingFileId === f.id,
                },
              ];
              return (
                <div
                  key={f.id}
                  className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-border-default hover:bg-surface-1 hover:shadow-[var(--elevation-xs)]"
                >
                  <button type="button" onClick={() => setPreviewFile(f)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    {f.iconLink ? (
                      // eslint-disable-next-line @next/next/no-img-element -- remote Google-hosted icon, no local optimization possible
                      <img src={f.iconLink} alt="" className="size-[18px] shrink-0" />
                    ) : (
                      <FileIcon size={18} className="shrink-0 text-neutral-400" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{f.name}</span>
                  </button>
                  <span className="w-16 shrink-0 text-xs text-neutral-400">{formatSize(f.sizeBytes)}</span>
                  <span className="w-24 shrink-0 text-xs text-neutral-400">{formatDate(f.modifiedTime)}</span>
                  <button
                    type="button"
                    aria-label={f.isFavorite ? "Quitar de favoritos" : "Marcar favorito"}
                    disabled={pendingFileId === f.id}
                    onClick={() => handleToggleFavorite(f)}
                    className={cn("shrink-0", f.isFavorite ? "text-warning" : "text-neutral-300 hover:text-warning")}
                  >
                    <Star size={16} className={cn(f.isFavorite && "fill-warning")} aria-hidden="true" />
                  </button>
                  <DropdownMenu trigger={<MoreVertical size={15} />} triggerLabel="Más opciones" items={menuItems} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {previewFile && <GoogleDrivePreviewDrawer file={previewFile} onClose={() => setPreviewFile(null)} />}
    </div>
  );
}
