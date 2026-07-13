"use client";

import { useState } from "react";
import { Files, Clock, Users, Star, Trash2, ChevronRight, Folder as FolderIcon } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { DocumentView, FolderNode } from "@/lib/documents/queries";

const QUICK_VIEWS: { key: DocumentView; label: string; icon: typeof Files }[] = [
  { key: "all", label: "Todos los documentos", icon: Files },
  { key: "recent", label: "Recientes", icon: Clock },
  { key: "shared", label: "Compartidos", icon: Users },
  { key: "favorites", label: "Favoritos", icon: Star },
  { key: "trash", label: "Papelera", icon: Trash2 },
];

function FolderTreeNode({
  folder,
  depth,
  allFolders,
  activeFolderId,
  onSelectFolder,
}: {
  folder: FolderNode;
  depth: number;
  allFolders: FolderNode[];
  activeFolderId: string | null;
  onSelectFolder: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const children = allFolders.filter((f) => f.parentFolderId === folder.id);
  const isActive = activeFolderId === folder.id;

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-1 rounded-md py-1 pr-2 text-[13px] transition-colors",
          isActive ? "bg-accent-100 text-accent-700" : "text-foreground hover:bg-surface-3",
        )}
        style={{ paddingLeft: 8 + depth * 14 }}
      >
        {children.length > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex size-4 shrink-0 items-center justify-center text-neutral-400"
          >
            <ChevronRight size={12} className={cn("transition-transform", expanded && "rotate-90")} aria-hidden="true" />
          </button>
        ) : (
          <span className="size-4 shrink-0" />
        )}
        <button type="button" onClick={() => onSelectFolder(folder.id)} className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left">
          <FolderIcon size={14} className="shrink-0 text-neutral-400" aria-hidden="true" />
          <span className="truncate">{folder.name}</span>
        </button>
      </div>
      {expanded &&
        children.map((child) => (
          <FolderTreeNode
            key={child.id}
            folder={child}
            depth={depth + 1}
            allFolders={allFolders}
            activeFolderId={activeFolderId}
            onSelectFolder={onSelectFolder}
          />
        ))}
    </div>
  );
}

export function DocumentsSidebar({
  view,
  folders,
  activeFolderId,
  onSelectView,
  onSelectFolder,
}: {
  view: DocumentView;
  folders: FolderNode[];
  activeFolderId: string | null;
  onSelectView: (view: DocumentView) => void;
  onSelectFolder: (id: string) => void;
}) {
  const rootFolders = folders.filter((f) => f.parentFolderId === null);

  return (
    <aside className="hidden w-[240px] shrink-0 flex-col gap-5 overflow-y-auto border-r border-border-default bg-surface-2/60 p-4 lg:flex">
      <nav className="flex flex-col gap-0.5">
        {QUICK_VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => onSelectView(v.key)}
            className={cn(
              "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors",
              view === v.key ? "bg-surface-1 text-foreground shadow-[var(--elevation-xs)]" : "text-neutral-600 hover:bg-surface-3",
            )}
          >
            <v.icon size={15} aria-hidden="true" />
            {v.label}
          </button>
        ))}
      </nav>

      <div className="flex flex-col gap-1.5">
        <h3 className="px-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Carpetas</h3>
        {rootFolders.length === 0 ? (
          <p className="px-2 text-[12.5px] text-neutral-400">Sin carpetas todavía.</p>
        ) : (
          rootFolders.map((f) => (
            <FolderTreeNode
              key={f.id}
              folder={f}
              depth={0}
              allFolders={folders}
              activeFolderId={activeFolderId}
              onSelectFolder={onSelectFolder}
            />
          ))
        )}
      </div>
    </aside>
  );
}
