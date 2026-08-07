"use client";

import { useCallback, useRef, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { updateMyAvatar } from "@/lib/profile/actions";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 8 * 1024 * 1024;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("No se pudo leer la imagen.")));
    img.src = src;
  });
}

/** Standard react-easy-crop canvas-extraction recipe — always re-encodes to
 * webp regardless of the source format (jpg/png/webp all accepted as
 * input), so the stored file is small and consistent. */
async function getCroppedBlob(imageSrc: string, area: Area): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen.");
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo procesar la imagen."))), "image/webp", 0.92);
  });
}

/** Upload → crop → save flow for "Mi Perfil"'s profile photo. One photo per
 * user at a fixed Storage path ({userId}/avatar.webp, `avatars` bucket —
 * 0049_user_avatars.sql), overwritten on every re-upload (upsert), so
 * there's never more than one object per user and every other module that
 * shows this user's avatar (via public.workspace_member_names) picks up the
 * change automatically the next time it refetches. The userId segment of
 * that path is resolved server-side (/api/profile/avatar) from the
 * authenticated session, not passed in from here. */
export function AvatarUploadDialog({
  open,
  onClose,
  onUploaded,
}: {
  open: boolean;
  onClose: () => void;
  onUploaded: (url: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => setCroppedArea(areaPixels), []);

  function reset() {
    setImageSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedArea(null);
    setIsSaving(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Formato no admitido — usá JPG, PNG o WEBP.");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("La imagen es demasiado grande (máximo 8 MB).");
      return;
    }
    // blob: URL en vez de FileReader.readAsDataURL — evita el límite de
    // WebKit para data: URIs grandes (fotos de cámara) en img.src/Cropper.
    setImageSrc(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (!imageSrc || !croppedArea) return;
    setIsSaving(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedArea);
      const body = new FormData();
      body.append("file", blob, "avatar.webp");
      const res = await fetch("/api/profile/avatar", { method: "POST", body });
      if (!res.ok) throw new Error("No se pudo subir la imagen.");
      // Cache-bust — the path is fixed/reused, so without the ?v= a browser
      // or CDN that already cached the previous photo at this exact URL
      // would keep showing it after a re-upload (the route appends it).
      const { url } = (await res.json()) as { url: string };

      await updateMyAvatar(url);
      toast.success("Foto de perfil actualizada.");
      onUploaded(url);
      handleClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar la foto.");
      setIsSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button aria-label="Cerrar" onClick={handleClose} className="absolute inset-0 bg-neutral-950/40" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Cambiar foto de perfil"
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-lg bg-surface-1 p-5 shadow-[var(--elevation-lg)]"
      >
        <h2 className="text-[15px] font-semibold text-foreground">Foto de perfil</h2>

        {!imageSrc ? (
          <div className="flex flex-col items-center gap-3 rounded-md border-2 border-dashed border-border-strong p-8">
            <Upload className="size-6 text-neutral-400" aria-hidden="true" />
            <p className="text-center text-xs text-neutral-500">JPG, PNG o WEBP — máximo 8 MB</p>
            <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
              Elegir imagen
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        ) : (
          <>
            <div className="relative h-72 w-full overflow-hidden rounded-md bg-neutral-900">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
              Zoom
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="accent-accent-500"
              />
            </label>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSaving}>
            Cancelar
          </Button>
          {imageSrc && (
            <Button type="button" onClick={handleSave} loading={isSaving}>
              Guardar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
