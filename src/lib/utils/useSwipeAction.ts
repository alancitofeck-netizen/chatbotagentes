"use client";

import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

const COMMIT_THRESHOLD_PX = 88;
/** Below this, a diagonal touch is treated as page scroll, not a swipe —
 * without a lock, the very first pixel of movement would already start
 * dragging the card sideways even for a mostly-vertical scroll gesture. */
const DIRECTION_LOCK_PX = 10;

export interface SwipeActionHandlers {
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
}

/** Hand-rolled horizontal swipe — no gesture library exists in this project
 * (confirmed: no react-swipeable/@use-gesture/framer-motion in package.json).
 * Touch-only (mouse drags are left alone, same reasoning as the Kanban's
 * separate MouseSensor/TouchSensor split in Fase 1). Relies on CSS
 * `touch-action: pan-y` on the swiped element (set by the caller) instead of
 * calling `preventDefault()` — that lets the browser keep native vertical
 * scroll working while this hook owns the horizontal axis, without the
 * cross-browser flakiness of trying to conditionally preventDefault a
 * non-passive pointermove from inside React's event system. */
export function useSwipeAction(onSwipeRight: () => void, onSwipeLeft: () => void): { deltaX: number; handlers: SwipeActionHandlers } {
  const [deltaX, setDeltaX] = useState(0);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const lockedRef = useRef<"horizontal" | "vertical" | null>(null);

  function reset() {
    startRef.current = null;
    lockedRef.current = null;
    setDeltaX(0);
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "touch") return;
    startRef.current = { x: e.clientX, y: e.clientY };
    lockedRef.current = null;
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!startRef.current) return;
    const dx = e.clientX - startRef.current.x;
    const dy = e.clientY - startRef.current.y;

    if (!lockedRef.current) {
      if (Math.abs(dx) < DIRECTION_LOCK_PX && Math.abs(dy) < DIRECTION_LOCK_PX) return;
      lockedRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      if (lockedRef.current === "vertical") {
        startRef.current = null;
        return;
      }
    }
    if (lockedRef.current === "horizontal") setDeltaX(dx);
  }

  function onPointerUp() {
    if (lockedRef.current === "horizontal") {
      if (deltaX >= COMMIT_THRESHOLD_PX) onSwipeRight();
      else if (deltaX <= -COMMIT_THRESHOLD_PX) onSwipeLeft();
    }
    reset();
  }

  return { deltaX, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: reset } };
}
