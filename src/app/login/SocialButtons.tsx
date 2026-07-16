"use client";

import { toast } from "@/components/toast/toast";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.89c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.89-3c-1.08.73-2.46 1.16-4.06 1.16-3.13 0-5.78-2.11-6.72-4.95H1.27v3.1C3.25 21.3 7.31 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4.01-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.61l4.01 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

function MetaIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        fill="#0866FF"
        d="M6.9 3.5C3.9 3.5 1.5 7.4 1.5 12.1c0 2.9 1.1 5 2.6 5 1.4 0 2.4-1.3 3.9-3.9.9-1.5 1.7-3.2 2.3-4.4.5 1 1.1 2.1 1.7 3.1.2.3.3.6.5.9-1.4 2.2-2.5 3.4-3.9 3.4v2.9c2.1 0 3.6-1.2 5.2-3.6.3.4.5.8.8 1.1 1.4 1.9 2.5 2.5 4 2.5 1.5 0 2.7-2 2.7-5.1 0-4.9-2.4-8.4-5.4-8.4-1.7 0-3.1 1.2-4.5 3.2C9.9 4.7 8.6 3.5 6.9 3.5Zm.1 2.9c.9 0 1.7.9 2.9 2.8-.6 1.2-1.3 2.6-2.1 3.8-1.1 1.7-1.7 2.1-2.2 2.1-.6 0-1-1-1-2.2 0-3.3 1.3-6.5 2.4-6.5Zm9.9 0c1.1 0 2.5 2.4 2.5 5.5 0 1.5-.4 2.2-.9 2.2-.5 0-1.1-.4-2.1-1.9-.6-.9-1.2-2-1.8-3.1 1.1-1.8 1.8-2.7 2.3-2.7Z"
      />
    </svg>
  );
}

export function SocialButtons() {
  function handleComingSoon(provider: string) {
    toast.info(`Iniciar sesión con ${provider} llega pronto.`);
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <button
        type="button"
        onClick={() => handleComingSoon("Google")}
        className="flex items-center justify-center gap-2 rounded-md border border-border-strong bg-surface-1 px-4 py-2.5 text-sm font-medium text-foreground transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--elevation-sm)]"
      >
        <GoogleIcon />
        Google
      </button>
      <button
        type="button"
        onClick={() => handleComingSoon("Meta")}
        className="flex items-center justify-center gap-2 rounded-md border border-border-strong bg-surface-1 px-4 py-2.5 text-sm font-medium text-foreground transition-all duration-[var(--duration-fast)] ease-[var(--ease-out)] hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--elevation-sm)]"
      >
        <MetaIcon />
        Meta
      </button>
    </div>
  );
}
