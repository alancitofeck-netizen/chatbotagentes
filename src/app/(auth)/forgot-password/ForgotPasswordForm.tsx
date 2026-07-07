"use client";

import { useActionState, useState } from "react";
import { MailCheck } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { validateEmail } from "@/lib/auth/validation";
import { EmptyState } from "@/components/ui/EmptyState";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = {};

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, initialState);
  const [fieldError, setFieldError] = useState<string>();

  if (state.sent) {
    return (
      <EmptyState
        icon={MailCheck}
        title="Revisa tu correo"
        description="Si existe una cuenta con ese correo, te enviamos un enlace para restablecer tu contraseña."
      />
    );
  }

  function handleSubmit(formData: FormData) {
    const email = String(formData.get("email") ?? "");
    const error = validateEmail(email);
    setFieldError(error);
    if (error) return;
    formAction(formData);
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Input
        name="email"
        type="email"
        label="Correo electrónico"
        placeholder="tú@empresa.com"
        autoComplete="email"
        error={fieldError}
        required
      />
      <Button type="submit" size="lg" fullWidth loading={isPending}>
        Enviar enlace de recuperación
      </Button>
    </form>
  );
}
