"use client";

import { useState } from "react";
import { Link2, QrCode, MessageCircle, Eye } from "lucide-react";
import { toast } from "@/components/toast/toast";
import type { MiniAppStatus } from "@/lib/miniApps/queries";
import { StatusBadge } from "@/components/responseSummary/StatusBadge";

/** Fila de acciones compartida por las 5 pestañas del detalle de una Mini
 * App — mismas convenciones ya usadas en el resto del módulo: URL pública
 * `${origin}/apps/${slug}` (MiniAppCard.tsx), `navigator.clipboard`
 * (MiniAppCard.tsx/ConfiguracionTab.tsx), `QRCode.toDataURL` (mismo patrón
 * que FinalizarStep.tsx en Presentaciones). El QR se genera al vuelo (no se
 * guarda en ningún lado) para no depender de un asset persistido. */
export function MiniAppHeaderActions({ slug, status }: { slug: string; status: MiniAppStatus }) {
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  function publicUrl() {
    return `${window.location.origin}/apps/${slug}`;
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(publicUrl());
    toast.success("Link copiado.");
  }

  async function handleQr() {
    setQrOpen(true);
    if (qrDataUrl) return;
    const QRCode = (await import("qrcode")).default;
    const dataUrl = await QRCode.toDataURL(publicUrl(), { width: 220, margin: 1 }).catch(() => null);
    setQrDataUrl(dataUrl);
  }

  function handleShareWhatsapp() {
    const text = encodeURIComponent(`Mirá esta calculadora: ${publicUrl()}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge variant={status === "active" ? "success" : "neutral"}>{status === "active" ? "Publicada" : "Borrador"}</StatusBadge>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button type="button" onClick={handleCopyLink} className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface-1 px-3.5 py-2 text-[13px] font-medium text-foreground hover:bg-surface-2">
          <Link2 size={14} aria-hidden="true" />
          Copiar enlace
        </button>
        <button type="button" onClick={handleQr} className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface-1 px-3.5 py-2 text-[13px] font-medium text-foreground hover:bg-surface-2">
          <QrCode size={14} aria-hidden="true" />
          Código QR
        </button>
        <button type="button" onClick={handleShareWhatsapp} className="inline-flex items-center gap-1.5 rounded-full border border-border-default bg-surface-1 px-3.5 py-2 text-[13px] font-medium text-foreground hover:bg-surface-2">
          <MessageCircle size={14} aria-hidden="true" />
          Compartir por WhatsApp
        </button>
        <a
          href={typeof window !== "undefined" ? publicUrl() : `/apps/${slug}`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-accent-500 to-primary-600 px-3.5 py-2 text-[13px] font-semibold text-white hover:brightness-110"
        >
          <Eye size={14} aria-hidden="true" />
          Ver como cliente
        </a>
      </div>

      {qrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Código QR">
          <button aria-label="Cerrar" onClick={() => setQrOpen(false)} className="absolute inset-0 bg-neutral-950/40" />
          <div className="relative flex flex-col items-center gap-3 rounded-lg bg-surface-1 p-6 shadow-[var(--elevation-lg)]">
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- data: URL generado en el cliente, no un asset servido por next/image
              <img src={qrDataUrl} alt="Código QR de la mini app" width={220} height={220} />
            ) : (
              <div className="flex size-[220px] items-center justify-center text-sm text-neutral-500">Generando…</div>
            )}
            <button type="button" onClick={() => setQrOpen(false)} className="rounded-full border border-border-default px-4 py-1.5 text-sm font-medium text-foreground hover:bg-surface-2">
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
