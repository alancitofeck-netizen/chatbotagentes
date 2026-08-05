"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { PublicPresentation } from "@/lib/presentations/queries";

export function PublicPresentationView({
  presentation,
  photoUrls,
  pdfUrl,
}: {
  presentation: PublicPresentation;
  photoUrls: string[];
  pdfUrl: string | null;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const primaryColor = presentation.personalInfo.primaryColor ?? "#6366F1";
  const slides = presentation.slides;
  const slide = slides[Math.min(activeIndex, Math.max(slides.length - 1, 0))];

  return (
    <div className="flex min-h-screen flex-col bg-neutral-50 dark:bg-neutral-950">
      <div className="h-1.5 w-full" style={{ backgroundColor: primaryColor }} />

      <header className="flex flex-col items-center gap-4 px-6 py-10 text-center">
        {photoUrls[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrls[0]} alt="" className="size-24 rounded-full object-cover shadow-[var(--elevation-md)]" />
        )}
        <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">
          {presentation.personalInfo.firstName} {presentation.personalInfo.lastName}
        </h1>
        <p className="text-sm text-neutral-500">{presentation.personalInfo.profession}</p>
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white shadow-[var(--elevation-sm)]"
            style={{ backgroundColor: primaryColor }}
          >
            <Download className="size-4" aria-hidden="true" />
            Descargar PDF
          </a>
        )}
      </header>

      {slides.length > 0 && (
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 pb-16">
          <div className="flex flex-wrap justify-center gap-1.5">
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setActiveIndex(i)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  i === activeIndex ? "text-white" : "bg-white text-neutral-500 dark:bg-neutral-900"
                }`}
                style={i === activeIndex ? { backgroundColor: primaryColor } : undefined}
              >
                {s.title}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
              disabled={activeIndex === 0}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-neutral-500 shadow-[var(--elevation-sm)] disabled:opacity-30 dark:bg-neutral-900"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </button>

            <div className="flex min-h-[280px] flex-1 flex-col justify-center gap-3 rounded-2xl bg-white p-8 shadow-[var(--elevation-md)] dark:bg-neutral-900">
              <h2 className="text-xl font-bold text-neutral-900 dark:text-white">{slide?.title}</h2>
              <p className="whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-300">{slide?.body}</p>
            </div>

            <button
              type="button"
              onClick={() => setActiveIndex((i) => Math.min(slides.length - 1, i + 1))}
              disabled={activeIndex === slides.length - 1}
              className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-neutral-500 shadow-[var(--elevation-sm)] disabled:opacity-30 dark:bg-neutral-900"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </button>
          </div>

          {photoUrls.length > 1 && (
            <div className="flex justify-center gap-2 overflow-x-auto">
              {photoUrls.slice(1).map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt="" className="h-20 w-16 shrink-0 rounded-lg object-cover" />
              ))}
            </div>
          )}
        </main>
      )}

      <footer className="py-6 text-center text-xs text-neutral-400">Creado con Growth Link ✨</footer>
    </div>
  );
}
