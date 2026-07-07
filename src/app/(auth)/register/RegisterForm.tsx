"use client";

import { useActionState, useEffect, useState } from "react";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import {
  validateEmail,
  validateName,
  validatePassword,
  validatePasswordConfirmation,
} from "@/lib/auth/validation";
import { toast } from "@/components/toast/toast";
import { signUp, type SignUpState } from "./actions";

const initialState: SignUpState = {};

type FieldErrors = {
  fullName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
};

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(signUp, initialState);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state.error]);

  function handleSubmit(formData: FormData) {
    const fullName = String(formData.get("fullName") ?? "");
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    const errors: FieldErrors = {
      fullName: validateName(fullName),
      email: validateEmail(email),
      password: validatePassword(password),
      confirmPassword: validatePasswordConfirmation(password, confirmPassword),
    };
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;
    formAction(formData);
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4" noValidate>
      <Input
        name="fullName"
        label="Nombre completo"
        placeholder="Sofía Reyes"
        autoComplete="name"
        error={fieldErrors.fullName}
        required
      />
      <Input
        name="email"
        type="email"
        label="Correo electrónico"
        placeholder="tú@empresa.com"
        autoComplete="email"
        error={fieldErrors.email}
        required
      />
      <PasswordInput
        name="password"
        label="Contraseña"
        placeholder="Mínimo 8 caracteres"
        autoComplete="new-password"
        error={fieldErrors.password}
        required
      />
      <PasswordInput
        name="confirmPassword"
        label="Confirmar contraseña"
        placeholder="Repite tu contraseña"
        autoComplete="new-password"
        error={fieldErrors.confirmPassword}
        required
      />
      <Button type="submit" size="lg" fullWidth loading={isPending}>
        Crear cuenta
      </Button>
      <p className="text-center text-xs text-neutral-500">
        Al crear tu cuenta se crea automáticamente tu workspace de Growth Link.
      </p>
    </form>
  );
}
