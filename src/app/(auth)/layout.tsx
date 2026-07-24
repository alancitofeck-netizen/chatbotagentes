import type { ReactNode } from "react";
import { Logo } from "@/components/brand/Logo";
import { PublicFooter } from "@/components/layout/PublicFooter";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="grid flex-1 lg:grid-cols-2">
        <div className="relative hidden flex-col justify-between overflow-hidden bg-primary-950 p-10 lg:flex">
          <Logo inverted />
          <div className="flex max-w-md flex-col gap-3">
            <p className="text-[28px] leading-[36px] font-semibold tracking-[-0.02em] text-white text-balance">
              Un solo lugar para conversaciones, CRM y reclutamiento.
            </p>
            <p className="text-[15px] leading-6 text-primary-300">
              IA y humanos trabajando sobre la misma bandeja de WhatsApp, con contexto compartido de cada contacto.
            </p>
          </div>
          <p className="text-xs text-primary-400">© {new Date().getFullYear()} Growth Link</p>
        </div>

        <div className="flex items-center justify-center bg-background p-6 sm:p-10">
          <div className="w-full max-w-[380px]">{children}</div>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
}
