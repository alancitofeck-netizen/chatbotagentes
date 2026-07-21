import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/** First real usage in the app (grepped — no prior Breadcrumbs component
 * existed anywhere), scoped for now to src/app/(protected)/inbox/layout.tsx.
 * Last item renders as plain text (current page, no link). */
export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={`${item.label}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight className="size-3.5 text-neutral-400" aria-hidden="true" />}
            {item.href && !isLast ? (
              <Link href={item.href} className="text-neutral-500 hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span aria-current={isLast ? "page" : undefined} className="font-medium text-foreground">
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
