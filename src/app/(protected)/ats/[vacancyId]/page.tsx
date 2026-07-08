import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getVacancyBoard } from "@/lib/ats/queries";
import { VacancyBoardView } from "./VacancyBoardView";

export const metadata: Metadata = {
  title: "Vacante — Growth Link",
};

export default async function VacancyBoardPage({ params }: { params: Promise<{ vacancyId: string }> }) {
  const { vacancyId } = await params;
  const { workspaceId } = await requireActiveWorkspace();
  const board = await getVacancyBoard(workspaceId, vacancyId);

  if (!board) notFound();

  return (
    <div className="flex h-full flex-col gap-4 py-4 sm:py-6 lg:py-8">
      <div className="flex flex-col gap-1 px-4 sm:px-6 lg:px-8">
        <Link href="/ats" className="flex w-fit items-center gap-1 text-xs text-neutral-500 hover:text-foreground">
          <ArrowLeft size={13} /> Vacantes
        </Link>
        <h1 className="text-[22px] leading-[30px] font-semibold tracking-[-0.02em] text-foreground">
          {board.vacancy.title}
        </h1>
        <p className="text-sm text-neutral-500">
          {[board.vacancy.department, board.vacancy.location].filter(Boolean).join(" · ") || "Arrastrá las tarjetas para mover un candidato de etapa."}
        </p>
      </div>
      <VacancyBoardView board={board} />
    </div>
  );
}
