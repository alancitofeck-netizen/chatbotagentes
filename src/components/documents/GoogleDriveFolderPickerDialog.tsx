"use client";

import { useEffect, useState, useTransition } from "react";
import { Folder as FolderIcon } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { listGoogleDriveFilesAction } from "@/lib/documents/googleDriveImport";

interface FolderCrumb {
  id: string | null;
  name: string;
}

/** Folder-only browser for "Exportar a Google Drive" — pick a destination
 * folder from the user's existing Drive, then upload. Deliberately its own
 * small component rather than reusing GoogleDriveBrowser in a "picker mode"
 * prop — that component's row actions (favorite/import/preview/share) don't
 * apply here at all, and a folders-only filtered list is a materially
 * simpler UI. */
export function GoogleDriveFolderPickerDialog({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (folderId: string | null, folderName: string) => void;
}) {
  const [crumbs, setCrumbs] = useState<FolderCrumb[]>([{ id: null, name: "Mi unidad" }]);
  const [folders, setFolders] = useState<{ id: string; name: string }[]>([]);
  const [isLoading, startLoading] = useTransition();

  function load(folderId: string | null) {
    startLoading(async () => {
      try {
        const result = await listGoogleDriveFilesAction({ folderId, foldersOnly: true });
        setFolders(result);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo listar Google Drive.");
      }
    });
  }

  useEffect(() => {
    load(null);
  }, []);

  function openFolder(folder: { id: string; name: string }) {
    setCrumbs((prev) => [...prev, folder]);
    load(folder.id);
  }

  function goToCrumb(index: number) {
    setCrumbs((prev) => prev.slice(0, index + 1));
    load(crumbs[index].id);
  }

  const current = crumbs[crumbs.length - 1];

  return (
    <Sheet open onClose={onClose} title="Exportar a Google Drive" className="max-w-lg">
      <div className="flex flex-col gap-3 p-5">
        <p className="text-sm text-neutral-500">Elegí la carpeta de destino en tu Google Drive.</p>

        <div className="flex flex-wrap items-center gap-1 text-[13px] text-neutral-500">
          {crumbs.map((c, i) => (
            <span key={c.id ?? "root"} className="flex items-center gap-1">
              {i > 0 && <span>/</span>}
              <button type="button" onClick={() => goToCrumb(i)} className="hover:text-foreground hover:underline">
                {c.name}
              </button>
            </span>
          ))}
        </div>

        <div className="max-h-72 overflow-y-auto rounded-md border border-border-default">
          {isLoading ? (
            <p className="p-4 text-sm text-neutral-500">Cargando…</p>
          ) : folders.length === 0 ? (
            <p className="p-4 text-sm text-neutral-500">Esta carpeta no tiene subcarpetas.</p>
          ) : (
            <ul className="divide-y divide-border-default">
              {folders.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => openFolder(f)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2"
                  >
                    <FolderIcon size={16} className="shrink-0 text-neutral-400" aria-hidden="true" />
                    <span className="truncate">{f.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={() => onPick(current.id, current.name)}>Exportar acá</Button>
        </div>
      </div>
    </Sheet>
  );
}
