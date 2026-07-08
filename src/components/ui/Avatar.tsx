import { cn } from "@/lib/utils/cn";

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
}

const PALETTE = [
  "bg-accent-500",
  "bg-primary-600",
  "bg-success",
  "bg-warning",
  "bg-primary-400",
  "bg-accent-700",
];

function colorFor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function Avatar({ name, src, size = 32, className }: AvatarProps) {
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.4) };

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- avatars are user-generated/remote, dimensions are dynamic
      <img
        src={src}
        alt={name}
        style={style}
        className={cn("rounded-full border-2 border-surface-1 object-cover", className)}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={name}
      style={style}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border-2 border-surface-1 font-semibold text-white",
        colorFor(name || "?"),
        className,
      )}
    >
      {initialsFor(name) || "?"}
    </span>
  );
}

export function AvatarStack({ names, max = 4 }: { names: string[]; max?: number }) {
  const visible = names.slice(0, max);
  const overflow = names.length - visible.length;
  return (
    <div className="flex">
      {visible.map((name, i) => (
        <Avatar key={`${name}-${i}`} name={name} size={24} className={cn(i > 0 && "-ml-2")} />
      ))}
      {overflow > 0 && (
        <span className="-ml-2 flex size-6 items-center justify-center rounded-full border-2 border-surface-1 bg-surface-3 text-[10px] font-semibold text-neutral-600">
          +{overflow}
        </span>
      )}
    </div>
  );
}
