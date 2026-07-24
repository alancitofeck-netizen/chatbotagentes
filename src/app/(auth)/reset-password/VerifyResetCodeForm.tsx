"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { verifyResetCode, type VerifyResetCodeState } from "./actions";

const initialState: VerifyResetCodeState = {};

export function VerifyResetCodeForm({ email }: { email: string }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(verifyResetCode, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    // router.refresh() (not redirect()) forces the page to re-read the
    // reset-token cookie that verifyResetCode just set — see the comment
    // on that action for why a same-URL redirect wouldn't pick it up.
    if (state.verified) router.refresh();
  }, [state.error, state.verified, router]);

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
