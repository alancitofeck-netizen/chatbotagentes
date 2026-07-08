"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, MapPin, Plus, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/toast/toast";
import type { VacancySummary } from "@/lib/ats/queries";
import { createVacancy } from "@/lib/ats/actions";

const STATUS_LABEL: Record<string, { label: string; variant: "accent" | "warning" | "neutral" }> = {
  open: { label: "Abierta", variant: "accent" },
  paused: { label: "Pausada", variant: "warning" },
  closed: { label: "Cerrada", variant: "neutral" },
};

function NewVacancySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleCreate() {
    if (!title.trim()) {
      toast.error("El título es obligatorio.");
      return;
    }
    startTransition(async () => {
      try {
        const vacancyId = await createVacancy({ title, department, location });
        toast.success("Vacante creada.");
        onClose();
        router.push(`/ats/${vacancyId}`);
      } catch {
        toast.error("No se pudo crear la vacante.");
      }
    });
  }

  return (
    <Sheet open={open} onClose={onClose} title="Nueva vacante">
      <div className="flex flex-col gap-4 p-5">
        <Input label="Título" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Diseñador/a UI/UX" />
        <Input label="Departamento" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Ej. Producto" />
        <Input label="Ubicación" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ej. Remoto" />
        <Button onClick={handleCreate} loading={isPending}>
          Crear vacante
        </Button>
      </div>
    </Sheet>
  );
}

export function VacancyList({ vacancies }: { vacancies: VacancySummary[] }) {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          {vacancies.length} {vacancies.length === 1 ? "vacante" : "vacantes"}
        </p>
        <Button size="sm" onClick={() => setSheetOpen(true)}>
          <Plus size={16} /> Nueva vacante
        </Button>
      </div>

      {vacancies.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="Todavía no hay vacantes"
          description="Creá la primera para empezar a recibir candidatos."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vacancies.map((v) => {
            const status = STATUS_LABEL[v.status] ?? STATUS_LABEL.open;
            return (
              <Link key={v.id} href={`/ats/${v.id}`}>
                <Card className="flex h-full flex-col gap-3 transition-shadow hover:shadow-[var(--elevation-md)]">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-[15px] font-medium text-foreground">{v.title}</h3>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  <div className="flex flex-col gap-1 text-xs text-neutral-500">
                    {v.department && <span>{v.department}</span>}
                    {v.location && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {v.location}
                      </span>
                    )}
                  </div>
                  <div className="mt-auto flex items-center gap-1.5 text-xs text-neutral-500">
                    <Users size={13} />
                    {v.candidateCount} {v.candidateCount === 1 ? "candidato" : "candidatos"}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <NewVacancySheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}
