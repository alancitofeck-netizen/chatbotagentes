"use client";

import { useRef, useState } from "react";
import { UploadCloud, X, RefreshCw, Crop, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { createClient } from "@/lib/supabase/client";
import { deletePresentationPhotoAction } from "@/lib/presentations/actions";
import type { PresentationPhoto } from "@/lib/presentations/constants";
import { PhotoCropDialog } from "./PhotoCropDialog";
import { CompareSlider } from "./CompareSlider";

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 8;

function publicUrl(path: string): string {
  return createClient().storage.from("presentation-assets").getPublicUrl(path).data.publicUrl;
}

export function FotosStep({
  presentationId,
  photos,
  onChange,
}: {
  presentationId: string;
  photos: PresentationPhoto[];
  onChange: (photos: PresentationPhoto[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState<string | null>(null);
  const [replacingPhotoId, setReplacingPhotoId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
      reader.readAsDataURL(file);
    });
  }

  async function handleFile(file: File, replacingId: string | null) {
    if (photos.length >= MAX_PHOTOS && !replacingId) {
      toast.error(`Máximo ${MAX_PHOTOS} fotos.`);
      return;
    }
    const dataUrl = await readAsDataUrl(file);
    setReplacingPhotoId(replacingId);
    setPendingImageSrc(dataUrl);
  }

  async function handleCropped(blob: Blob) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", new File([blob], "photo.webp", { type: "image/webp" }));
      formData.append("presentationId", presentationId);
      const res = await fetch("/api/presentations/photo-upload", { method: "POST", body: formData });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "No se pudo subir la foto.");

      if (replacingPhotoId) {
        onChange(photos.map((p) => (p.id === replacingPhotoId ? { ...p, originalPath: result.path, selectedPath: result.path } : p)));
      } else {
        const newPhoto: PresentationPhoto = {
          id: crypto.randomUUID(),
          originalPath: result.path,
          selectedPath: result.path,
          enhancedPath: null,
          cropMeta: null,
        };
        onChange([...photos, newPhoto]);
      }
      setPendingImageSrc(null);
      setReplacingPhotoId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo subir la foto.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photo: PresentationPhoto) {
    onChange(photos.filter((p) => p.id !== photo.id));
    try {
      await deletePresentationPhotoAction(presentationId, photo.id);
    } catch {
      /* best-effort — la foto ya se sacó de la vista */
    }
  }

  function handleRecortar(photo: PresentationPhoto) {
    setReplacingPhotoId(photo.id);
    setPendingImageSrc(publicUrl(photo.originalPath));
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Fotos</h2>
        <p className="text-sm text-neutral-500">Subí entre {MIN_PHOTOS} y {MAX_PHOTOS} fotografías — vas a poder recortarlas, rotarlas y hacer zoom.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((photo) => (
          <div key={photo.id} className="group relative aspect-[4/5] overflow-hidden rounded-lg border border-border-default bg-surface-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={publicUrl(photo.selectedPath)} alt="" className="size-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <button type="button" title="Recortar/rotar/zoom" onClick={() => handleRecortar(photo)} className="flex size-8 items-center justify-center rounded-full bg-white/90 text-neutral-700 hover:bg-white">
                <Crop className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                title="Cambiar"
                onClick={() => {
                  setReplacingPhotoId(photo.id);
                  inputRef.current?.click();
                }}
                className="flex size-8 items-center justify-center rounded-full bg-white/90 text-neutral-700 hover:bg-white"
              >
                <RefreshCw className="size-4" aria-hidden="true" />
              </button>
              <button type="button" title="Eliminar" onClick={() => handleDelete(photo)} className="flex size-8 items-center justify-center rounded-full bg-white/90 text-error-strong hover:bg-white">
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}

        {photos.length < MAX_PHOTOS && (
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              setReplacingPhotoId(null);
              inputRef.current?.click();
            }}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragOver(true);
            }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file, null);
            }}
            className={`flex aspect-[4/5] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-3 text-center transition-colors ${
              isDragOver ? "border-accent-500 bg-accent-500/5" : "border-border-default bg-surface-2 hover:border-accent-300"
            }`}
          >
            <UploadCloud className="size-6 text-neutral-400" aria-hidden="true" />
            <p className="text-xs text-neutral-500">Arrastrá o hacé clic</p>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file, replacingPhotoId);
        }}
      />

      {photos.length < MIN_PHOTOS && <p className="text-xs text-warning-strong">Subí al menos {MIN_PHOTOS} fotos para continuar.</p>}

      <div className="rounded-lg border border-border-default bg-surface-2 p-4">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div>
            <p className="text-sm font-medium text-foreground">Mejora profesional con IA</p>
            <p className="text-xs text-neutral-500">Quita el fondo, corrige iluminación y genera una versión estilo corporativo — próximamente.</p>
          </div>
          <Button size="lg" disabled title="Próximamente">
            <Sparkles className="size-4" aria-hidden="true" />
            ✨ Mejorar con IA
          </Button>
        </div>

        {photos.length > 0 && (
          <div className="mt-4 flex flex-col items-center gap-2">
            <CompareSlider leftSrc={publicUrl(photos[0].selectedPath)} rightSrc={publicUrl(photos[0].selectedPath)} rightLabel="IA (próximamente)" />
            <p className="text-xs text-neutral-400">El comparador se activa cuando la mejora con IA esté disponible.</p>
          </div>
        )}
      </div>

      {pendingImageSrc && (
        <PhotoCropDialog
          imageSrc={pendingImageSrc}
          onCancel={() => {
            setPendingImageSrc(null);
            setReplacingPhotoId(null);
          }}
          onCropped={handleCropped}
        />
      )}
      {uploading && <p className="text-xs text-neutral-500">Subiendo…</p>}
    </div>
  );
}
