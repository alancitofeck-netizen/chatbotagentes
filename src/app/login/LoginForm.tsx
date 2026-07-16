"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";
import { validateEmail, validatePassword } from "@/lib/auth/validation";
import { toast } from "@/components/toast/toast";
import { signIn, type SignInState } from "./actions";
import { SocialButtons } from "./SocialButtons";

const initialState: SignInState = {};

/** Visual redesign only — the actual sign-in call (signIn/actions.ts),
 * client-side validation, and error surfacing are byte-for-byte the same
 * logic the old src/app/(auth)/login/LoginForm.tsx had. "Recordarme" has no
 * backend behind it (Supabase's session cookie already persists the login
 * regardless), so it's deliberately local UI state only — not wired to
 * anything, matching the "no tocar la lógica" instruction. */
export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, formAction, isPending] = useActionState(signIn, initialState);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [rememberMe, setRememberMe] = useState(true);

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
    <div className="flex flex-col gap-6">
      <form action={handleSubmit} className="flex flex-col gap-5" noValidate>
        <input type="hidden" name="next" value={next} />
        <Input
          name="email"
          type="email"
          label="Email"
          placeholder="tú@empresa.com"
          autoComplete="email"
          error={fieldErrors.email}
          required
        />
        <PasswordInput
          name="password"
          label="Contraseña"
          placeholder="••••••••"
          autoComplete="current-password"
          error={fieldErrors.password}
          required
        />

        <div className="flex items-center justify-between">
          <label className="flex select-none items-center gap-2 text-sm text-neutral-600">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="size-4 rounded-xs border-border-strong text-accent-500 focus-visible:outline-2 focus-visible:outline-accent-500 focus-visible:outline-offset-2"
            />
            Recordarme
          </label>
          <Link href="/forgot-password" className="text-sm font-medium text-accent-600 hover:text-accent-700">
            ¿Olvidaste tu contraseña?
          </Link>
        </div>

        <Button type="submit" size="lg" fullWidth loading={isPending} className="mt-1">
          Iniciar sesión
        </Button>
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border-default" />
        <span className="text-xs font-medium text-neutral-400">o continuar con</span>
        <div className="h-px flex-1 bg-border-default" />
      </div>

      <SocialButtons />

      <p className="text-center text-sm text-neutral-500">
        ¿No tienes una cuenta?{" "}
        <Link
          href="/register"
          className="font-medium text-accent-600 underline decoration-transparent underline-offset-4 transition-colors duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:text-accent-700 hover:decoration-accent-700"
        >
          Crear cuenta
        </Link>
      </p>
    </div>
  );
}
