"use client";

import { useCallback, useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", () => reject(new Error("No se pudo leer la imagen.")));
    img.src = src;
  });
}

/** Mismo recorte por canvas que LogoCropDialog.tsx (mini-apps), extendido
 * con rotación (react-easy-crop ya soporta `rotation`/`onRotationChange`,
 * solo faltaba cablearlo — LogoCropDialog no lo necesitaba). */
async function getCroppedBlob(imageSrc: string, area: Area, rotationDeg: number): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const radians = (rotationDeg * Math.PI) / 180;

  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen.");

  if (rotationDeg !== 0) {
    ctx.translate(area.width / 2, area.height / 2);
    ctx.rotate(radians);
    ctx.translate(-area.width / 2, -area.height / 2);
  }
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No se pudo procesar la imagen."))), "image/webp", 0.92);
  });
}

export function PhotoCropDialog({ imageSrc, onCancel, onCropped }: { imageSrc: string; onCancel: () => void; onCropped: (blob: Blob) => void }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => setCroppedArea(areaPixels), []);

  async function handleSave() {
    if (!croppedArea) return;
    setIsSaving(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedArea, rotation);
      onCropped(blob);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo procesar la imagen.");
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button aria-label="Cancelar" onClick={onCancel} className="absolute inset-0 bg-neutral-950/40" />
      <div role="dialog" aria-modal="true" aria-label="Ajustar foto" className="relative flex w-full max-w-md flex-col gap-4 rounded-lg bg-surface-1 p-5 shadow-[var(--elevation-lg)]">
        <h2 className="text-[15px] font-semibold text-foreground">Ajustar foto</h2>

        <div className="relative h-80 w-full overflow-hidden rounded-md bg-neutral-900">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={4 / 5}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={onCropComplete}
          />
        </div>

        <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
          Zoom
          <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="accent-accent-500" />
        </label>
        <label className="flex flex-col gap-1.5 text-xs text-neutral-500">
          Rotación
          <input type="range" min={0} max={360} step={1} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} className="accent-accent-500" />
        </label>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={isSaving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} loading={isSaving}>
            Usar esta foto
          </Button>
        </div>
      </div>
    </div>
  );
}
