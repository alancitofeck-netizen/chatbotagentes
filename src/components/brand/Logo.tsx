import Image from "next/image";
import { cn } from "@/lib/utils/cn";

// Plain public/ path (not a static import) — files under public/ are served
// as-is by Next.js, not bundled as modules; next/image still optimizes it
// at request time from a string src, just needs explicit dimensions since
// there's no import to infer them from. Real intrinsic size is 200x200.
const LOGO_SRC = "/growth_businesss_logo.jpg";
const IMAGE_SIZE = { sm: "size-8", lg: "size-24" };

/**
 * Real Growth Link mark (public/growth_businesss_logo.jpg) — the wordmark
 * is already baked into the image, so this renders just the image, no
 * adjacent text label like the old placeholder square+text version had.
 * `inverted` wraps it in a white rounded chip so it keeps real presence on
 * a dark background (the badge's own navy can otherwise blend into a dark
 * gradient) instead of trying to recolor a fixed JPEG.
 */
export function Logo({
  className,
  inverted = false,
  size = "sm",
}: {
  className?: string;
  inverted?: boolean;
  size?: "sm" | "lg";
}) {
  return (
    <div
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden",
        IMAGE_SIZE[size],
        inverted ? "rounded-full bg-white p-1 shadow-[var(--elevation-md)]" : "rounded-full",
        className,
      )}
    >
      <Image src={LOGO_SRC} alt="Growth Link" width={200} height={200} className="size-full rounded-full object-cover" priority />
    </div>
  );
}
