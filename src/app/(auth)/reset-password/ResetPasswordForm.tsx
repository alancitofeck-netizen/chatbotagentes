"use client";

import { useActionState, useEffect, useState } from "react";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { validatePassword, validatePasswordConfirmation } from "@/lib/auth/validation";
import { toast } from "@/components/toast/toast";
import { resetPassword, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = {};

export function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState(resetPassword, initialState);
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmPassword?: string }>({});

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state.error]);

  function handleSubmit(formData: FormData) {
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");
    const errors = {
      password: validatePassword(password),
      confirmPassword: validatePasswordConfirmation(password, confirmPassword),
    };
    setFieldErrors(errors);
    if (errors.password || errors.confirmPassword) return;
    formAction(formData);
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4" noValidate>
      <PasswordInput
        name="password"
        label="Nueva contraseña"
        placeholder="Mínimo 8 caracteres"
        autoComplete="new-password"
        error={fieldErrors.password}
        required
      />
      <PasswordInput
        name="confirmPassword"
        label="Confirmar nueva contraseña"
        placeholder="Repite tu nueva contraseña"
        autoComplete="new-password"
        error={fieldErrors.confirmPassword}
        required
      />
      <Button type="submit" size="lg" fullWidth loading={isPending}>
        Restablecer contraseña
      </Button>
    </form>
  );
}
