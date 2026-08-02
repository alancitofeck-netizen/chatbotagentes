"use client";

import { Children } from "react";
import type { ReactNode } from "react";
import { useIsMobile } from "@/lib/utils/useMediaQuery";

/** Generic "cards → horizontal swipe carousel" wrapper (optimización mobile
 * Fase 3) — no existing snap-scroll pattern anywhere in this project to
 * extend, so this is the one reusable primitive both KpiCards.tsx and
 * KpisSection.tsx wrap their stat cards in, instead of building the
 * carousel twice. Desktop is untouched: below `md` it renders
 * `desktopClassName` (the caller's existing grid) with children as-is; on
 * mobile each child gets wrapped in its own snap-start slide instead. */
export function HorizontalCardScroller({ children, desktopClassName }: { children: ReactNode; desktopClassName: string }) {
  const isMobile = useIsMobile();

  if (!isMobile) {
    return <div className={desktopClassName}>{children}</div>;
  }

  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
      {Children.map(children, (child, i) => (
        <div key={i} className="w-[78vw] max-w-[280px] shrink-0 snap-start">
          {child}
        </div>
      ))}
    </div>
  );
}
