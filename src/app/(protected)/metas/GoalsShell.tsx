"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Target } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { getGoalsBoardAction, type GoalsBoard } from "@/lib/goals/actions";
import type { GoalKind } from "@/lib/goals/constants";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import { GoalsHeader } from "./GoalsHeader";
import { GoalCard } from "./GoalCard";
import { ProjectionPanel } from "./ProjectionPanel";
import { ProductBreakdownChart } from "./ProductBreakdownChart";
import { RankingList } from "./RankingList";
import { AchievementsGrid } from "./AchievementsGrid";
import { TimelineView } from "./TimelineView";
import { HistorySheet } from "./HistorySheet";
import { GoalFormSheet } from "./GoalFormSheet";
import { CelebrationBurst } from "./CelebrationBurst";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
function startOfMonthIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

export function GoalsShell({ initialBoard, members }: { initialBoard: GoalsBoard; members: WorkspaceMemberOption[] }) {
  const [board, setBoard] = useState(initialBoard);
  const [formKind, setFormKind] = useState<GoalKind | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(board.newlyUnlocked.length > 0);
  const seenCompletedIds = useRef(new Set(initialBoard.goals.filter((g) => g.projection.paceStatus === "completed").map((g) => g.id)));

  const canManage = board.role === "owner" || board.role === "admin";

  async function refreshBoard() {
    const fresh = await getGoalsBoardAction();
    const newlyCompleted = fresh.goals.some((g) => g.projection.paceStatus === "completed" && !seenCompletedIds.current.has(g.id));
    for (const g of fresh.goals) if (g.projection.paceStatus === "completed") seenCompletedIds.current.add(g.id);
    if (newlyCompleted || fresh.newlyUnlocked.length > 0) setCelebrating(true);
    setBoard(fresh);
  }

  return (
    <div className="flex flex-col gap-6">
      <GoalsHeader canManage={canManage} onCreateGoal={() => setFormKind("meta")} onCreateBono={() => setFormKind("bono")} onOpenHistory={() => setHistoryOpen(true)} />

      <div className="flex flex-col gap-6 px-4 sm:px-6 lg:px-8">
        {board.goals.length === 0 ? (
          <EmptyState
            icon={Target}
            title="Todavía no hay objetivos activos"
            description={canManage ? "Creá tu primera meta o bono para empezar a trackear el avance." : "Todavía no te asignaron un objetivo — hablá con tu owner/admin."}
          />
        ) : (
          <motion.div layout className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {board.goals.map((goal) => (
              <GoalCard key={goal.id} goal={goal} onOpen={() => {}} />
            ))}
          </motion.div>
        )}

        <ProjectionPanel goals={board.goals} />

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <ProductBreakdownChart periodStart={startOfMonthIso()} periodEnd={todayIso()} scope="own" />
          <RankingList currentMemberId={board.memberId} />
        </div>

        <AchievementsGrid unlocked={board.achievements} />

        <TimelineView />
      </div>

      {formKind && <GoalFormSheet goalKind={formKind} members={members} onClose={() => setFormKind(null)} onSaved={refreshBoard} />}
      {historyOpen && <HistorySheet onClose={() => setHistoryOpen(false)} />}
      <CelebrationBurst active={celebrating} onComplete={() => setCelebrating(false)} />
    </div>
  );
}
