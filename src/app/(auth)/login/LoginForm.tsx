"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { validateEmail, validatePassword } from "@/lib/auth/validation";
import { toast } from "@/components/toast/toast";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = {};

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, formAction, isPending] = useActionState(signIn, initialState);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    if (initialError) toast.error(initialError);
  }, [initialError]);

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state.error]);

  function handleSubmit(formData: FormData) {
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const errors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setFieldErrors(errors);
    if (errors.email || errors.password) return;
    formAction(formData);
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <Input
        name="email"
        type="email"
        label="Correo electrónico"
        placeholder="tú@empresa.com"
        autoComplete="email"
        error={fieldErrors.email}
        required
      />
      <div className="flex flex-col gap-1.5">
        <PasswordInput
          name="password"
          label="Contraseña"
          placeholder="••••••••"
          autoComplete="current-password"
          error={fieldErrors.password}
          required
        />
        <Link
          href="/forgot-password"
          className="self-end text-xs font-medium text-accent-600 hover:text-accent-700"
        >
          ¿Olvidaste tu contraseña?
        </Link>
      </div>
      <Button type="submit" size="lg" fullWidth loading={isPending}>
        Iniciar sesión
      </Button>
    </form>
  );
}
