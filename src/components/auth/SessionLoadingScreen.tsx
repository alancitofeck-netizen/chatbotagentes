import { Spinner } from "@/components/ui/Spinner";

interface SessionLoadingScreenProps {
  title: string;
  description?: string;
}

/** Shared by session-establishing states ("Verificando sesión") and the
 * (protected) layout's loading.tsx ("Cargando sesión") — same component,
 * different copy, per the approved plan. */
export function SessionLoadingScreen({ title, description }: SessionLoadingScreenProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <Spinner size={28} label={title} />
      <div className="flex flex-col gap-1">
        <p className="text-[15px] font-medium text-foreground">{title}</p>
        {description && <p className="text-sm text-neutral-500">{description}</p>}
      </div>
    </div>
  );
}
