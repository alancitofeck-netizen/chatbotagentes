"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { Check, Copy, Download, Share2, Copy as DuplicateIcon, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { createClient } from "@/lib/supabase/client";
import type { PresentationDetail } from "@/lib/presentations/queries";
import { finalizePresentationAction, duplicatePresentationAction, deletePresentationAction } from "@/lib/presentations/actions";

function CopyableLine({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2 rounded-md border border-border-default bg-surface-2 px-3 py-2">
      <code className="flex-1 truncate text-[13px] text-foreground">{value}</code>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="shrink-0 text-neutral-500 hover:text-foreground"
      >
        {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      </button>
    </div>
  );
}

export function FinalizarStep({
  presentation,
  onFinalized,
}: {
  presentation: PresentationDetail;
  onFinalized: (shareSlug: string, pdfStoragePath: string) => void;
}) {
  const router = useRouter();
  const [finalizing, setFinalizing] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const isReady = presentation.status === "lista" && Boolean(presentation.shareSlug);
  const shareUrl = presentation.shareSlug && typeof window !== "undefined" ? `${window.location.origin}/p/${presentation.shareSlug}` : "";
  const pdfUrl = presentation.pdfStoragePath ? createClient().storage.from("presentation-assets").getPublicUrl(presentation.pdfStoragePath).data.publicUrl : null;

  useEffect(() => {
    if (!shareUrl) return;
    QRCode.toDataURL(shareUrl, { width: 220, margin: 1 }).then(setQrDataUrl).catch(() => setQrDataUrl(null));
  }, [shareUrl]);

  async function handleFinalize() {
    setFinalizing(true);
    try {
      const { shareSlug, pdfStoragePath } = await finalizePresentationAction(presentation.id);
      onFinalized(shareSlug, pdfStoragePath);
      toast.success("¡Presentación lista!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo finalizar.");
    } finally {
      setFinalizing(false);
    }
  }

  async function handleDuplicate() {
    try {
      const { id } = await duplicatePresentationAction(presentation.id);
      router.push(`/presentaciones/${id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo duplicar.");
    }
  }

  async function handleDelete() {
    if (!window.confirm("¿Eliminar esta presentación? Esta acción no se puede deshacer.")) return;
    try {
      await deletePresentationAction(presentation.id);
      router.push("/presentaciones");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar.");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Finalizar</h2>
        <p className="text-sm text-neutral-500">Generá la versión pública, el PDF y el código QR para compartir tu presentación.</p>
      </div>

      {!isReady ? (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border-default bg-surface-2 p-10 text-center">
          <p className="text-sm text-neutral-500">Al finalizar, generamos tu presentación web, versión PDF, versión móvil y un código QR — todo guardado automáticamente.</p>
          <Button size="lg" onClick={handleFinalize} loading={finalizing}>
            Finalizar presentación
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-3">
              <CopyableLine value={shareUrl} />
              {pdfUrl && (
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" className="w-full">
                    <Download className="size-4" aria-hidden="true" />
                    Descargar PDF
                  </Button>
                </a>
              )}
              <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="secondary" className="w-full">
                  <Share2 className="size-4" aria-hidden="true" />
                  Ver / Compartir
                </Button>
              </a>
              <Button variant="secondary" onClick={handleDuplicate}>
                <DuplicateIcon className="size-4" aria-hidden="true" />
                Duplicar
              </Button>
              <Button variant="ghost" onClick={handleDelete} className="text-error-strong">
                <Trash2 className="size-4" aria-hidden="true" />
                Eliminar
              </Button>
            </div>

            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border-default bg-surface-2 p-6">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="Código QR" className="size-[180px]" />
              ) : (
                <p className="text-xs text-neutral-500">Generando QR…</p>
              )}
              <p className="text-xs text-neutral-500">Código QR — versión móvil</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
