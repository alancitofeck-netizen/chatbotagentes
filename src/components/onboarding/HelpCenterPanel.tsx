"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Search, GraduationCap, PlayCircle, HelpCircle, MessageCircle, ChevronRight } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Input } from "@/components/ui/Input";
import { useOnboarding } from "./OnboardingContext";
import { LearningProgress } from "./LearningProgress";
import { ALL_TOURS } from "@/lib/tours/registry";
import { getModuleIdForPathname } from "@/lib/tours/currentModule";

const SUPPORT_EMAIL = "support@growthlink.uk";

const FAQ_ITEMS: { q: string; a: string }[] = [
  { q: "¿Puedo omitir el onboarding inicial?", a: "Sí, cada paso se puede omitir sin que te bloquee — podés retomarlo cuando quieras desde acá o desde Configuración." },
  { q: "¿Cómo repito un tutorial que ya vi?", a: "Buscá el botón \"¿Qué hago acá?\" arriba de cualquier módulo, o el tour de ese módulo en \"Aprender este módulo\" más abajo." },
  { q: "¿Los tutoriales modifican mis datos reales?", a: "No — nunca. Los tutoriales solo resaltan elementos reales de la pantalla, no crean ni modifican información salvo que vos mismo completes un formulario real durante el recorrido." },
  { q: "¿Puedo activar o desactivar un módulo?", a: "Sí, desde Configuración → Módulos (solo Owner/Admin)." },
];

type View = "menu" | "search" | "faq";

export function HelpCenterPanel() {
  const { isHelpCenterOpen, closeHelpCenter, startTour } = useOnboarding();
  const pathname = usePathname();
  const [view, setView] = useState<View>("menu");
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentModuleId = getModuleIdForPathname(pathname);
  const currentModuleTours = useMemo(() => ALL_TOURS.filter((t) => t.moduleKey === currentModuleId), [currentModuleId]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { tours: [], faq: [] };
    return {
      tours: ALL_TOURS.filter((t) => t.title.toLowerCase().includes(q)),
      faq: FAQ_ITEMS.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)),
    };
  }, [query]);

  function close() {
    closeHelpCenter();
    setView("menu");
    setQuery("");
  }

  function launchTour(key: string) {
    startTour(key);
    close();
  }

  if (!isHelpCenterOpen) return null;

  return (
    <Sheet open onClose={close} title="¿En qué podemos ayudarte?">
      <div className="flex flex-col gap-4 p-5">
        <Input
          ref={searchInputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setView(e.target.value.trim() ? "search" : "menu");
          }}
          placeholder="Ej. crear un lead, conectar WhatsApp…"
          label="¿Qué querés hacer?"
        />

        {view === "search" && (
          <div className="flex flex-col gap-3">
            {searchResults.tours.length === 0 && searchResults.faq.length === 0 && <p className="text-sm text-neutral-500">Sin resultados para “{query}”.</p>}
            {searchResults.tours.map((t) => (
              <MenuRow key={t.key} icon={PlayCircle} label={t.title} onClick={() => launchTour(t.key)} />
            ))}
            {searchResults.faq.map((f) => (
              <div key={f.q} className="rounded-md border border-border-default p-3">
                <p className="text-sm font-medium text-foreground">{f.q}</p>
                <p className="mt-1 text-[13px] text-neutral-600">{f.a}</p>
              </div>
            ))}
          </div>
        )}

        {view === "menu" && (
          <div className="flex flex-col gap-1">
            <MenuRow icon={Search} label="Buscar ayuda" onClick={() => searchInputRef.current?.focus()} />
            {currentModuleTours.length > 0 ? (
              <>
                {currentModuleTours.map((t) => (
                  <MenuRow key={`learn-${t.key}`} icon={GraduationCap} label={`Aprender este módulo: ${t.title}`} onClick={() => launchTour(t.key)} />
                ))}
                {currentModuleTours.map((t) => (
                  <MenuRow key={`replay-${t.key}`} icon={PlayCircle} label="Ver tutorial" onClick={() => launchTour(t.key)} />
                ))}
              </>
            ) : (
              <p className="px-3 py-2 text-[13px] text-neutral-400">Este módulo todavía no tiene un tutorial interactivo.</p>
            )}
            <MenuRow icon={HelpCircle} label="Preguntas frecuentes" onClick={() => setView("faq")} />
            <a href={`mailto:${SUPPORT_EMAIL}`} className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm text-foreground hover:bg-surface-2">
              <span className="flex items-center gap-2.5">
                <MessageCircle size={16} className="text-neutral-400" aria-hidden="true" />
                Contactar soporte
              </span>
              <ChevronRight size={14} className="text-neutral-300" aria-hidden="true" />
            </a>

            <div className="my-2 border-t border-border-default" />
            <LearningProgress showHelpCta={false} onNavigateAway={close} />
          </div>
        )}

        {view === "faq" && (
          <div className="flex flex-col gap-3">
            {FAQ_ITEMS.map((f) => (
              <div key={f.q} className="rounded-md border border-border-default p-3">
                <p className="text-sm font-medium text-foreground">{f.q}</p>
                <p className="mt-1 text-[13px] text-neutral-600">{f.a}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </Sheet>
  );
}

function MenuRow({ icon: Icon, label, onClick }: { icon: typeof Search; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center justify-between rounded-md px-3 py-2.5 text-left text-sm text-foreground hover:bg-surface-2">
      <span className="flex items-center gap-2.5">
        <Icon size={16} className="text-neutral-400" aria-hidden="true" />
        {label}
      </span>
      <ChevronRight size={14} className="text-neutral-300" aria-hidden="true" />
    </button>
  );
}
