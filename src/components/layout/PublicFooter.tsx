import Link from "next/link";
import { Logo } from "@/components/brand/Logo";

/** Shown on every unauthenticated page (login, register, and the legal pages
 * themselves) so Google's OAuth verification review — and any real visitor —
 * can always reach Privacy/Terms from wherever they land, without needing an
 * account. Deliberately not added to any (protected)/ page. */
export function PublicFooter() {
  return (
    <footer className="border-t border-border-default bg-surface-1">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-6 py-8 text-sm text-neutral-500 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-2">
          <Logo size="sm" />
          <span>© {new Date().getFullYear()} Growth Link</span>
        </div>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link href="/privacy" className="hover:text-foreground">
            Política de Privacidad
          </Link>
          <Link href="/terms" className="hover:text-foreground">
            Términos y Condiciones
          </Link>
          <a href="mailto:support@growthlink.uk" className="hover:text-foreground">
            support@growthlink.uk
          </a>
        </nav>
      </div>
    </footer>
  );
}
