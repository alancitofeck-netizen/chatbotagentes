"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { requestPasswordReset, type ForgotPasswordState } from "../forgot-password/actions";

const initialState: ForgotPasswordState = {};

/** Reuses requestPasswordReset directly (same anti-enumeration + rate-limit
 * + createAndSendOtp path as the initial /forgot-password submit, then
 * redirects back to this same ?email= page) rather than a separate
 * "resend" action — there's nothing about resending that differs. */
export function ResendResetCodeButton({ email }: { email: string }) {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, initialState);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state.error]);

  return (
    <form action={formAction}>
      <input type="hidden" name="email" value={email} />
      <Button type="submit" variant="secondary" fullWidth loading={isPending}>
        Reenviar código
      </Button>
    </form>
  );
}
