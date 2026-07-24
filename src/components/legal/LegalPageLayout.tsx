import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { PublicFooter } from "@/components/layout/PublicFooter";

/** Shared shell for the two public legal pages (/privacy, /terms) — no auth,
 * no dashboard chrome, just enough branding to look like part of GrowthLink
 * and be safely readable by a Google OAuth verification reviewer. */
export function LegalPageLayout({
  title,
  lastUpdated,
  children,
}: {
  title: string;
  lastUpdated: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-surface-2">
      <header className="border-b border-border-default bg-surface-1">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size="sm" />
            <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">GrowthLink</span>
          </Link>
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Volver
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:py-16">
        <div className="flex flex-col gap-2">
          <h1 className="text-balance text-[32px] leading-[40px] font-semibold tracking-[-0.02em] text-foreground">
            {title}
          </h1>
          <p className="text-sm text-neutral-500">Última actualización: {lastUpdated}</p>
        </div>

        <div
          className="
            mt-10 flex flex-col gap-6 text-[15px] leading-7 text-neutral-700
            [&_h2]:mt-6 [&_h2]:text-[20px] [&_h2]:leading-7 [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-foreground
            [&_h3]:mt-2 [&_h3]:text-[16px] [&_h3]:font-semibold [&_h3]:text-foreground
            [&_p]:text-neutral-700 [&_li]:text-neutral-700
            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5
            [&_a]:font-medium [&_a]:text-accent-600 [&_a]:underline [&_a]:decoration-transparent [&_a]:underline-offset-4 [&_a]:hover:text-accent-700 [&_a]:hover:decoration-accent-700
            [&_strong]:text-foreground [&_strong]:font-semibold
          "
        >
          {children}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
