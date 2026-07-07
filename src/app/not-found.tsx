import type { Metadata } from "next";
import { Compass } from "lucide-react";
import { LinkButton } from "@/components/ui/LinkButton";
import { Logo } from "@/components/brand/Logo";

export const metadata: Metadata = {
  title: "Página no encontrada — Growth Link",
};

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <Logo />
      <Compass className="size-10 text-neutral-400" strokeWidth={1.5} aria-hidden="true" />
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">
          Página no encontrada
        </h1>
        <p className="max-w-sm text-sm text-neutral-500">
          El enlace que seguiste no existe o se movió. Revisa la dirección o vuelve al inicio.
        </p>
      </div>
      <LinkButton href="/">Volver al inicio</LinkButton>
    </div>
  );
}
