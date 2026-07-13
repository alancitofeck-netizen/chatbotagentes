import type { CrmBoard } from "@/lib/crm/queries";

export interface StageFunnel {
  stageId: string;
  stageName: string;
  count: number;
  value: number;
  isWon: boolean;
  isLost: boolean;
}

export interface CrmAnalyticsData {
  funnel: StageFunnel[];
  openPipelineValue: number;
  wonCount: number;
  wonValue: number;
  lostCount: number;
  conversionRate: number;
  avgDealSize: number;
}

/** Pure — derives everything from the CrmBoard already fetched by
 * getCrmBoard (src/lib/crm/queries.ts), no extra Supabase round-trip.
 * "Won"/"lost" is read from the stage a card currently sits in
 * (pipeline_stages.is_won/is_lost), the actual source of truth — not
 * opportunities.status, which historically nothing kept in sync (see the
 * fix in moveOpportunityCard, src/lib/crm/actions.ts). */
export function deriveCrmAnalytics(board: CrmBoard): CrmAnalyticsData {
  const funnel: StageFunnel[] = board.stages.map((stage) => {
    const cards = board.cardsByStage[stage.id] ?? [];
    return {
      stageId: stage.id,
      stageName: stage.name,
      count: cards.length,
      value: cards.reduce((sum, c) => sum + c.value, 0),
      isWon: stage.isWon,
      isLost: stage.isLost,
    };
  });

  const wonStages = funnel.filter((s) => s.isWon);
  const lostStages = funnel.filter((s) => s.isLost);
  const openStages = funnel.filter((s) => !s.isWon && !s.isLost);

  const wonCount = wonStages.reduce((sum, s) => sum + s.count, 0);
  const wonValue = wonStages.reduce((sum, s) => sum + s.value, 0);
  const lostCount = lostStages.reduce((sum, s) => sum + s.count, 0);
  const openPipelineValue = openStages.reduce((sum, s) => sum + s.value, 0);

  return {
    funnel,
    openPipelineValue,
    wonCount,
    wonValue,
    lostCount,
    conversionRate: wonCount + lostCount > 0 ? Math.round((wonCount / (wonCount + lostCount)) * 1000) / 10 : 0,
    avgDealSize: wonCount > 0 ? wonValue / wonCount : 0,
  };
}
