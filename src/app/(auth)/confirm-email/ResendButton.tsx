"use client";

import { useActionState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { resendConfirmation, type ResendState } from "./actions";

const initialState: ResendState = {};

export function ResendButton({ email }: { email: string }) {
  const [state, formAction, isPending] = useActionState(resendConfirmation, initialState);

  useEffect(() => {
    if (state.sent) toast.success("Te reenviamos el correo de confirmación.");
    if (state.error) toast.error(state.error);
  }, [state.sent, state.error]);

  return (
    <form action={formAction}>
      <input type="hidden" name="email" value={email} />
      <Button type="submit" variant="secondary" fullWidth loading={isPending}>
        Reenviar correo
      </Button>
    </form>
  );
}
