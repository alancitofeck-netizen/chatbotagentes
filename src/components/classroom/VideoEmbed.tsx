"use client";

import { forwardRef } from "react";
import { AlertTriangle } from "lucide-react";
import { detectProvider } from "@/lib/classroom/video";

/** Dumb renderer only — takes a raw URL, renders the right <iframe>/<video>.
 * No progress logic here (that's VideoPlayer.tsx, which wraps this). Used
 * both by the real lesson player and by the admin lesson editor's live
 * preview, so it must tolerate an empty/invalid URL gracefully rather than
 * throwing. */
export const VideoEmbed = forwardRef<HTMLVideoElement, { url: string; className?: string; onTimeUpdate?: (seconds: number) => void }>(
  function VideoEmbed({ url, className, onTimeUpdate }, ref) {
    const embed = detectProvider(url);
    const base = "aspect-video w-full overflow-hidden rounded-lg bg-neutral-950";

    if (embed.provider === "unknown") {
      return (
        <div className={`${base} flex flex-col items-center justify-center gap-2 text-center ${className ?? ""}`}>
          {embed.originalUrl ? (
            <>
              <AlertTriangle className="size-6 text-warning" aria-hidden="true" />
              <p className="max-w-xs text-sm text-neutral-300">No pudimos reconocer este link de video.</p>
              <a href={embed.originalUrl} target="_blank" rel="noreferrer" className="text-sm text-accent-400 underline">
                Abrir enlace original
              </a>
            </>
          ) : (
            <p className="text-sm text-neutral-400">Sin video para esta lección.</p>
          )}
        </div>
      );
    }

    if (embed.provider === "mp4") {
      return (
        <video
          ref={ref}
          src={embed.src}
          controls
          className={`${base} ${className ?? ""}`}
          onTimeUpdate={(e) => onTimeUpdate?.(Math.floor(e.currentTarget.currentTime))}
        />
      );
    }

    return (
      <div className={`${base} ${className ?? ""}`}>
        <iframe
          src={embed.embedUrl}
          title="Video de la lección"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className="size-full"
        />
      </div>
    );
  },
);
