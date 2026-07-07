import type { ReactNode } from "react";

interface AuthCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthCard({ title, description, children, footer }: AuthCardProps) {
  return (
    <div className="flex w-full flex-col gap-6 rounded-lg bg-surface-1 p-6 shadow-[var(--elevation-sm)] sm:p-8">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground text-balance">
          {title}
        </h1>
        {description && <p className="text-sm text-neutral-500">{description}</p>}
      </div>
      {children}
      {footer && <div className="text-sm text-neutral-500">{footer}</div>}
    </div>
  );
}
