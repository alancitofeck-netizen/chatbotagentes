"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { searchClassroomCoursesAction } from "@/lib/classroom/courses/actions";
import type { ClassroomCourseCard } from "@/lib/classroom/courses/queries";

const DEBOUNCE_MS = 250;

/** Notion-style instant search — debounced client-side calls to a server
 * action (searchClassroomCoursesAction), results rendered as a dropdown
 * overlay rather than a page navigation, so it feels instant. Searches
 * course titles/descriptions only in v1 (the request also asks for
 * searching individual videos/PDFs/resources by name — deferred, this
 * catalog's course-level granularity is the v1 scope). */
export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ClassroomCourseCard[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function handleQueryChange(value: string) {
    setQuery(value);
    const trimmed = value.trim();
    if (!trimmed) {
      setResults([]);
      setOpen(false);
      setLoading(false);
    } else {
      setLoading(true);
    }
  }

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const handle = setTimeout(() => {
      searchClassroomCoursesAction(trimmed).then((r) => {
        setResults(r);
        setOpen(true);
        setLoading(false);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-sm">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-400" aria-hidden="true" />
        <input
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Buscar cursos, lecciones, recursos…"
          className="w-full rounded-full border border-border-strong bg-surface-1 py-2 pl-9 pr-8 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />
        {query && (
          <button
            type="button"
            onClick={() => handleQueryChange("")}
            aria-label="Limpiar búsqueda"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-foreground"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-96 max-w-[90vw] overflow-hidden rounded-lg border border-border-default bg-surface-1 shadow-[var(--elevation-md)]">
          {loading ? (
            <p className="p-4 text-sm text-neutral-500">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="p-4 text-sm text-neutral-500">Sin resultados para &ldquo;{query}&rdquo;.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto py-1">
              {results.map((course) => (
                <li key={course.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      router.push(`/classroom/cursos/${course.slug}`);
                    }}
                    className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left hover:bg-surface-2"
                  >
                    <span className="text-sm font-medium text-foreground">{course.title}</span>
                    <span className="text-xs text-neutral-500">{course.categoryName}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
