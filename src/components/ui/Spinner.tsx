import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils/cn";

interface SpinnerProps {
  size?: number;
  className?: string;
  label?: string;
}

export function Spinner({ size = 20, className, label = "Cargando" }: SpinnerProps) {
  return (
    <span role="status" className="inline-flex items-center">
      <LoaderCircle
        className={cn("animate-spin text-accent-500", className)}
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
