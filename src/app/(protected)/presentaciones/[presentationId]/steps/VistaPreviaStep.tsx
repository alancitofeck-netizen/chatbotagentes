"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Presentation as PresentationIcon } from "lucide-react";
import type { PresentationSlide } from "@/lib/presentations/constants";

/** Navegador tipo diapositivas — cada una editable inline. Opera sobre
 * `slides` (sembrado desde ai_content en IaStep.tsx pero editable de forma
 * independiente desde acá en adelante — un ajuste manual nunca se pisa si
 * se vuelve a generar con IA). */
export function VistaPreviaStep({ slides, onChange }: { slides: PresentationSlide[]; onChange: (slides: PresentationSlide[]) => void }) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (slides.length === 0) {
    return (
      <EmptyState
        icon={PresentationIcon}
        title="Todavía no hay diapositivas"
        description="Generá el contenido con IA en el paso anterior para armar la vista previa."
      />
    );
  }

  const slide = slides[Math.min(activeIndex, slides.length - 1)];

  function updateSlide(patch: Partial<PresentationSlide>) {
    onChange(slides.map((s) => (s.key === slide.key ? { ...s, ...patch } : s)));
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Vista previa</h2>
        <p className="text-sm text-neutral-500">Navegá y editá cada diapositiva de tu presentación.</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {slides.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setActiveIndex(i)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              i === activeIndex ? "bg-accent-500 text-white" : "bg-surface-3 text-neutral-500 hover:text-foreground"
            }`}
          >
            {i + 1}. {s.title}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setActiveIndex((i) => Math.max(0, i - 1))}
          disabled={activeIndex === 0}
          className="flex size-8 items-center justify-center rounded-full border border-border-default text-neutral-500 hover:text-foreground disabled:opacity-30"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>

        <div className="flex aspect-video w-full max-w-2xl flex-col justify-center gap-4 rounded-xl border border-border-default bg-gradient-to-br from-surface-1 to-surface-2 p-8 shadow-[var(--elevation-md)]">
          <input
            value={slide.title}
            onChange={(e) => updateSlide({ title: e.target.value })}
            className="bg-transparent text-2xl font-bold text-foreground outline-none focus:ring-0"
          />
          <textarea
            value={slide.body}
            onChange={(e) => updateSlide({ body: e.target.value })}
            rows={6}
            className="resize-none bg-transparent text-sm text-neutral-600 outline-none focus:ring-0"
          />
        </div>

        <button
          type="button"
          onClick={() => setActiveIndex((i) => Math.min(slides.length - 1, i + 1))}
          disabled={activeIndex === slides.length - 1}
          className="flex size-8 items-center justify-center rounded-full border border-border-default text-neutral-500 hover:text-foreground disabled:opacity-30"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex justify-center">
        <Button variant="ghost" size="sm" onClick={() => setActiveIndex((i) => (i + 1) % slides.length)}>
          Siguiente diapositiva
        </Button>
      </div>
    </div>
  );
}
