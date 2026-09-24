"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { verifyMfaAtLogin } from "../actions";

/** Mismo layout de card centrada que /login (page.tsx) — solo el contenido
 * cambia. `router.push` + `router.refresh()` en vez de un redirect() de
 * servidor: la sesión recién verificada vive en las cookies que este mismo
 * navegador ya tiene, así que un refresh de cliente alcanza para que
 * middleware.ts vea la sesión al día en el próximo request. */
export function VerifyMfaForm({ factorId, next }: { factorId: string; next: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return;
    startTransition(async () => {
      const res = await verifyMfaAtLogin(factorId, code);
      if (res.error) {
        setError(res.error);
        setCode("");
        return;
      }
      router.push(next);
      router.refresh();
    });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-surface-2 p-4">
      <Logo />
      <div className="w-full max-w-sm rounded-[28px] bg-surface-1 p-8 shadow-[var(--elevation-lg)]">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-accent-100 text-accent-700">
            <ShieldCheck className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-[19px] font-semibold text-foreground">Verificación en dos pasos</h1>
            <p className="mt-1 text-sm text-neutral-500">Ingresá el código de tu app de autenticación.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Código de 6 dígitos"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
              setError(null);
            }}
            error={error ?? undefined}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            className="text-center text-lg tracking-[0.5em]"
          />
          <Button type="submit" size="lg" fullWidth loading={isPending} disabled={code.length !== 6}>
            Verificar
          </Button>
        </form>
      </div>
    </div>
  );
}
