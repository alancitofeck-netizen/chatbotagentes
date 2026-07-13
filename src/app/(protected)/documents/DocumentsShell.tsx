"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Plus,
  Upload,
  FolderPlus,
  FileUp,
  Download,
  ChevronRight,
  LayoutGrid,
  List as ListIcon,
} from "lucide-react";
import { buttonClassName } from "@/components/ui/Button";
import { DropdownMenu } from "@/components/ui/DropdownMenu";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/toast/toast";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";
import type { DocumentItem, DocumentView, FolderNode } from "@/lib/documents/queries";
import {
  createFolder,
  getDocumentByIdAction,
  getDocumentsAction,
  getFolderTreeAction,
  recordUploadedDocument,
} from "@/lib/documents/actions";
import { ENTITY_LABELS, type ExportEntity, type ExportFormat } from "@/lib/documents/exportConstants";
import { ACCEPTED_EXTENSIONS } from "@/components/documents/documentIcons";
import { DocumentsSidebar } from "@/components/documents/DocumentsSidebar";
import { DocumentsGrid } from "@/components/documents/DocumentsGrid";
import { DocumentDetailDrawer } from "@/components/documents/DocumentDetailDrawer";
import { ImportWizard } from "@/components/documents/ImportWizard";

const VIEW_LABELS: Record<DocumentView, string> = {
  all: "Todos los documentos",
  recent: "Recientes",
  shared: "Compartidos",
  favorites: "Favoritos",
  trash: "Papelera",
};

const EXPORT_ENTITIES = Object.keys(ENTITY_LABELS) as ExportEntity[];
const EXPORT_FORMATS: { value: ExportFormat; label: string; disabled?: boolean }[] = [
  { value: "csv", label: "CSV" },
  { value: "xlsx", label: "Excel (.xlsx)" },
  { value: "pdf", label: "PDF" },
];

interface MemberOption {
  memberId: string;
  fullName: string;
}

interface UploadState {
  name: string;
  status: "uploading" | "done" | "error";
}

export function DocumentsShell({
  workspaceId,
  initialDocuments,
  initialFolders,
  members,
  ownMemberId,
}: {
  workspaceId: string;
  initialDocuments: DocumentItem[];
  initialFolders: FolderNode[];
  members: MemberOption[];
  ownMemberId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedView = searchParams.get("view");
  const view: DocumentView = (["all", "recent", "shared", "favorites", "trash"] as const).includes(requestedView as DocumentView)
    ? (requestedView as DocumentView)
    : "all";
  const folderId = searchParams.get("folder");

  const [documents, setDocuments] = useState(initialDocuments);
  const [folders, setFolders] = useState(initialFolders);
  const [search, setSearch] = useState("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentItem | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Several actions can each trigger their own refetch in quick succession
  // (e.g. create a folder, then immediately upload a file) — without
  // sequencing, an earlier request resolving after a later one would
  // overwrite fresher data with stale data. Same fix as CalendarShell.tsx's
  // refetch this session: only the most-recently-*issued* request is
  // allowed to apply its result, regardless of resolve order.
  const latestRequestId = useRef(0);

  const runFetch = useCallback((nextView: DocumentView, nextFolderId: string | null) => {
    const requestId = ++latestRequestId.current;
    startTransition(async () => {
      const [freshDocs, freshFolders] = await Promise.all([
        getDocumentsAction({ view: nextView, folderId: nextView === "all" ? nextFolderId : undefined, search }),
        getFolderTreeAction(),
      ]);
      if (requestId !== latestRequestId.current) return;
      setDocuments(freshDocs);
      setFolders(freshFolders);
    });
  }, [search]);

  const refetch = useCallback(() => runFetch(view, folderId), [runFetch, view, folderId]);

  // The server only ever fetches the default (view=all, folder=root) once on
  // first render (src/app/(protected)/documents/page.tsx doesn't read
  // searchParams) — a hard navigation/reload to e.g. ?view=trash would
  // otherwise keep showing that stale root-view data forever, since nothing
  // else re-fetches on mount. Same "refetch whenever the visible scope
  // changes" effect as CalendarShell.tsx's; setUrl below intentionally does
  // NOT also call runFetch directly, so there's a single source of truth.
  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, folderId]);

  function setUrl(nextView: DocumentView, nextFolderId: string | null) {
    const params = new URLSearchParams();
    params.set("view", nextView);
    if (nextFolderId) params.set("folder", nextFolderId);
    router.replace(`/documents?${params.toString()}`, { scroll: false });
  }

  const visibleFolders = useMemo(
    () => (view === "all" ? folders.filter((f) => f.parentFolderId === folderId) : []),
    [folders, view, folderId],
  );

  const breadcrumbs = useMemo(() => {
    if (view !== "all") return [];
    const chain: FolderNode[] = [];
    let current = folders.find((f) => f.id === folderId) ?? null;
    while (current) {
      chain.unshift(current);
      current = folders.find((f) => f.id === current!.parentFolderId) ?? null;
    }
    return chain;
  }, [folders, folderId, view]);

  async function handleNewFolder() {
    const name = window.prompt("Nombre de la nueva carpeta:");
    if (!name?.trim()) return;
    try {
      await createFolder(name.trim(), view === "all" ? folderId : null);
      toast.success("Carpeta creada.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la carpeta.");
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    const list = Array.from(files);
    const targetFolderId = view === "all" ? folderId : null;
    setUploads(list.map((f) => ({ name: f.name, status: "uploading" as const })));

    const supabase = createClient();
    for (const file of list) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!ACCEPTED_EXTENSIONS.includes(ext)) {
        setUploads((prev) => prev.map((u) => (u.name === file.name ? { ...u, status: "error" } : u)));
        toast.error(`Tipo de archivo no soportado: ${file.name}`);
        continue;
      }
      const documentId = crypto.randomUUID();
      const storagePath = `${workspaceId}/${documentId}/${file.name}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(storagePath, file);
      if (uploadError) {
        setUploads((prev) => prev.map((u) => (u.name === file.name ? { ...u, status: "error" } : u)));
        toast.error(`No se pudo subir ${file.name}.`);
        continue;
      }
      try {
        await recordUploadedDocument({
          name: file.name,
          folderId: targetFolderId,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          storagePath,
        });
        setUploads((prev) => prev.map((u) => (u.name === file.name ? { ...u, status: "done" } : u)));
      } catch {
        setUploads((prev) => prev.map((u) => (u.name === file.name ? { ...u, status: "error" } : u)));
      }
    }
    toast.success("Carga finalizada.");
    refetch();
    setTimeout(() => setUploads([]), 2500);
  }

  async function handleSelectDocument(id: string) {
    const fresh = await getDocumentByIdAction(id);
    if (fresh) setSelectedDocument(fresh);
  }

  return (
    <div
      className="flex h-full"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
      }}
    >
      <DocumentsSidebar
        view={view}
        folders={folders}
        activeFolderId={view === "all" ? folderId : null}
        onSelectView={(v) => setUrl(v, null)}
        onSelectFolder={(id) => setUrl("all", id)}
      />

      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-default px-6 py-4">
          <div className="flex items-center gap-3">
            <h1 className="text-[19px] font-semibold text-foreground">Documentos</h1>
            <div className="relative w-64">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && refetch()}
                placeholder="Buscar documentos…"
                className="w-full rounded-full border border-border-strong bg-surface-1 py-1.5 pl-9 pr-3 text-sm outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu
              trigger={
                <>
                  <Download size={14} aria-hidden="true" />
                  Exportar
                </>
              }
              triggerClassName={buttonClassName({ variant: "secondary", size: "sm" })}
              align="end"
              items={EXPORT_ENTITIES.flatMap((entity) => [
                ...EXPORT_FORMATS.map((f) => ({
                  label: `${ENTITY_LABELS[entity]} — ${f.label}`,
                  onSelect: () => window.open(`/api/documents/export?entity=${entity}&format=${f.value}`, "_blank"),
                })),
                {
                  label: `${ENTITY_LABELS[entity]} — Google Sheets`,
                  disabled: true,
                  onSelect: () => toast.error("Conectá Google Drive primero (Perfil > Integraciones)."),
                },
              ])}
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && uploadFiles(e.target.files)}
            />
            <DropdownMenu
              trigger={
                <>
                  <Plus size={15} aria-hidden="true" />
                  Nuevo
                </>
              }
              triggerClassName={buttonClassName({ size: "sm" })}
              items={[
                { label: "Nueva carpeta", icon: <FolderPlus size={14} />, onSelect: handleNewFolder },
                { label: "Subir archivos", icon: <Upload size={14} />, onSelect: () => fileInputRef.current?.click() },
                { label: "Importar", icon: <FileUp size={14} />, onSelect: () => setImportOpen(true) },
              ]}
            />
            <div className="flex gap-1 rounded-full bg-surface-2 p-1">
              <button
                type="button"
                aria-label="Vista de cuadrícula"
                aria-pressed={layout === "grid"}
                onClick={() => setLayout("grid")}
                className={cn("flex size-7 items-center justify-center rounded-full", layout === "grid" ? "bg-surface-1 shadow-[var(--elevation-xs)]" : "text-neutral-500")}
              >
                <LayoutGrid size={14} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Vista de lista"
                aria-pressed={layout === "list"}
                onClick={() => setLayout("list")}
                className={cn("flex size-7 items-center justify-center rounded-full", layout === "list" ? "bg-surface-1 shadow-[var(--elevation-xs)]" : "text-neutral-500")}
              >
                <ListIcon size={14} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 px-6 pt-3 text-[13px] text-neutral-500">
          <button type="button" onClick={() => setUrl(view === "all" ? "all" : view, null)} className="hover:text-foreground hover:underline">
            {VIEW_LABELS[view]}
          </button>
          {breadcrumbs.map((f) => (
            <span key={f.id} className="flex items-center gap-1">
              <ChevronRight size={13} aria-hidden="true" />
              <button type="button" onClick={() => setUrl("all", f.id)} className="hover:text-foreground hover:underline">
                {f.name}
              </button>
            </span>
          ))}
        </div>

        <div className="flex-1 overflow-auto px-6 py-4">
          {documents.length === 0 && visibleFolders.length === 0 ? (
            <EmptyState
              icon={Upload}
              title="Sin documentos"
              description="Arrastrá archivos acá o usá el botón «Nuevo» para empezar."
            />
          ) : (
            <DocumentsGrid
              layout={layout}
              view={view}
              documents={documents}
              folders={visibleFolders}
              onOpenFolder={(id) => setUrl("all", id)}
              onOpenDocument={handleSelectDocument}
              onChanged={refetch}
            />
          )}
        </div>

        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center border-4 border-dashed border-accent-400 bg-accent-50/70">
            <p className="text-lg font-semibold text-accent-700">Soltá los archivos para subirlos</p>
          </div>
        )}

        {uploads.length > 0 && (
          <div className="absolute bottom-4 right-4 z-30 flex w-72 flex-col gap-2 rounded-xl border border-border-default bg-surface-1 p-3 shadow-[var(--elevation-md)]">
            <p className="text-[12px] font-semibold text-foreground">Subiendo archivos…</p>
            {uploads.map((u) => (
              <div key={u.name} className="flex items-center justify-between gap-2 text-[12px]">
                <span className="truncate text-neutral-600">{u.name}</span>
                <span
                  className={cn(
                    "shrink-0 font-medium",
                    u.status === "done" ? "text-success-strong" : u.status === "error" ? "text-error-strong" : "text-neutral-400",
                  )}
                >
                  {u.status === "done" ? "Listo" : u.status === "error" ? "Error" : "…"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedDocument && (
        <DocumentDetailDrawer
          document={selectedDocument}
          members={members}
          ownMemberId={ownMemberId}
          onClose={() => setSelectedDocument(null)}
          onChanged={() => {
            refetch();
            handleSelectDocument(selectedDocument.id);
          }}
        />
      )}

      {importOpen && <ImportWizard onClose={() => setImportOpen(false)} onImported={refetch} />}
    </div>
  );
}
