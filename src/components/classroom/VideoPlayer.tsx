"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { detectProvider } from "@/lib/classroom/video";
import { markLessonComplete, markLessonIncomplete, saveResumePosition } from "@/lib/classroom/progress/actions";
import { VideoEmbed } from "./VideoEmbed";

const RESUME_SAVE_INTERVAL_SECONDS = 10;

/** The component pages actually import — VideoEmbed itself has zero progress
 * awareness. Resume-position tracking only fires for direct-MP4 lessons
 * (the only provider with a real, cross-origin-free `timeupdate` event — see
 * video.ts's doc comment); completion is always the manual button below,
 * for every provider including MP4 (no auto-complete-at-95%-watched in v1). */
export function VideoPlayer({
  videoUrl,
  lessonId,
  courseSlug,
  isCompleted,
  initialResumePositionSeconds = 0,
}: {
  videoUrl: string;
  lessonId: string;
  courseSlug: string;
  isCompleted: boolean;
  initialResumePositionSeconds?: number;
}) {
  const router = useRouter();
  const [completed, setCompleted] = useState(isCompleted);
  const [isPending, startTransition] = useTransition();
  const lastSavedRef = useRef(0);
  const seekedRef = useRef(false);
  const embed = detectProvider(videoUrl);

  function handleTimeUpdate(seconds: number) {
    if (embed.provider !== "mp4") return;
    if (seconds - lastSavedRef.current >= RESUME_SAVE_INTERVAL_SECONDS) {
      lastSavedRef.current = seconds;
      void saveResumePosition(lessonId, seconds);
    }
  }

  function handleVideoRef(el: HTMLVideoElement | null) {
    if (!el || seekedRef.current || !initialResumePositionSeconds) return;
    el.currentTime = initialResumePositionSeconds;
    seekedRef.current = true;
  }

  function toggleComplete() {
    const next = !completed;
    setCompleted(next);
    startTransition(async () => {
      try {
        if (next) await markLessonComplete(lessonId, courseSlug);
        else await markLessonIncomplete(lessonId, courseSlug);
        // The server-computed progress shown elsewhere on this same page
        // (chapter N/M counts in the left nav, the right sidebar's overall
        // %) was fetched once at page load and has no other way to learn
        // this changed without navigating away — refresh so it does.
        router.refresh();
      } catch {
        setCompleted(!next);
        toast.error("No se pudo guardar el progreso.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <VideoEmbed url={videoUrl} onTimeUpdate={handleTimeUpdate} ref={handleVideoRef} />
      <Button
        type="button"
        variant={completed ? "secondary" : "primary"}
        onClick={toggleComplete}
        disabled={isPending}
        className="self-start"
      >
        {completed ? <CheckCircle2 size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}
        {completed ? "Completada" : "Marcar como completada"}
      </Button>
    </div>
  );
}
