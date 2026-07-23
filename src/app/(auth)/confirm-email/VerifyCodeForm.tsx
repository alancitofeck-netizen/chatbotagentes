"use client";

import { useActionState, useEffect } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { verifySignupCode, type VerifyCodeState } from "./actions";

const initialState: VerifyCodeState = {};

export function VerifyCodeForm({ email }: { email: string }) {
  const [state, formAction, isPending] = useActionState(verifySignupCode, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state.error]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="email" value={email} />
      <Input
        name="code"
        label="Código de verificación"
        placeholder="123456"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        pattern="[0-9]*"
        autoFocus
        required
        className="text-center text-2xl font-semibold tracking-[0.5em]"
      />
      <Button type="submit" size="lg" fullWidth loading={isPending}>
        Verificar código
      </Button>
    </form>
  );
}
