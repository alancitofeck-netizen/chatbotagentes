"use client";

import { ExternalLink } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { buttonClassName } from "@/components/ui/Button";
import type { DriveFile } from "@/lib/integrations/googleDrive";

/** Google's own `/preview` embed works via iframe for Docs/Sheets/Slides/
 * PDFs/images (and most other types Drive can render at all) with zero
 * exporting or extra API calls — this alone covers every file type listed
 * in the spec. Types Drive genuinely can't preview just render a blank/
 * error frame from Google's side, so "Abrir en Drive" is always offered
 * alongside it rather than trying to detect iframe failure client-side
 * (cross-origin iframes don't expose their load outcome to us). */
export function GoogleDrivePreviewDrawer({ file, onClose }: { file: DriveFile; onClose: () => void }) {
  const previewUrl = `https://drive.google.com/file/d/${file.id}/preview`;

  return (
    <Sheet open onClose={onClose} title={file.name} className="max-w-3xl">
      <div className="flex h-full flex-col gap-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-neutral-500">Vista previa de Google Drive.</p>
          {file.webViewLink && (
            <a href={file.webViewLink} target="_blank" rel="noreferrer" className={buttonClassName({ variant: "secondary", size: "sm" })}>
              <ExternalLink size={14} aria-hidden="true" />
              Abrir en Drive
            </a>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border-default">
          <iframe src={previewUrl} title={file.name} className="size-full" allow="autoplay" />
        </div>
      </div>
    </Sheet>
  );
}
