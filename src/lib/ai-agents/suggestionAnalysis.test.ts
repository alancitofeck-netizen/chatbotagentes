import { describe, it, expect } from "vitest";
import {
  detectFailingTools,
  detectLowConversion,
  detectHighConversion,
  detectStalledReferrals,
  detectSlowResponses,
  detectFastResponses,
  detectHighToolSuccess,
  buildAgentFindings,
  type ToolCallStat,
  type ReferralStats,
} from "./suggestionAnalysis";
import type { AgentMetrics } from "./queries";

function tool(overrides: Partial<ToolCallStat> = {}): ToolCallStat {
  return { toolId: "tool-1", toolName: "Crear oportunidad", totalCalls: 0, executedCount: 0, failedCount: 0, avgLatencyMs: null, ...overrides };
}

function referralStats(overrides: Partial<ReferralStats["byStatus"]> = {}): ReferralStats {
  const byStatus = { nuevo: 0, contactado: 0, interesado: 0, no_interesado: 0, convertido: 0, ...overrides };
  return { total: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus };
}

function metrics(overrides: Partial<AgentMetrics> = {}): AgentMetrics {
  return { conversationsHandled: 0, avgLatencyMs: null, totalTokensIn: 0, totalTokensOut: 0, totalCostUsd: 0, humanHandoffs: 0, daily: [], ...overrides };
}

describe("detectFailingTools", () => {
  it("flags a tool with >=3 calls and >=30% failure rate", () => {
    const findings = detectFailingTools([tool({ totalCalls: 5, executedCount: 1, failedCount: 4 })]);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ kind: "opportunity", field: "tools", toolId: "tool-1" });
  });

  it("ignores a tool below the minimum call volume even at 100% failure", () => {
    const findings = detectFailingTools([tool({ totalCalls: 2, failedCount: 2 })]);
    expect(findings).toHaveLength(0);
  });

  it("ignores a tool with enough volume but a low failure rate", () => {
    const findings = detectFailingTools([tool({ totalCalls: 10, executedCount: 9, failedCount: 1 })]);
    expect(findings).toHaveLength(0);
  });
});

describe("detectLowConversion / detectHighConversion", () => {
  it("returns null below the minimum referral volume, even at 0% conversion", () => {
    expect(detectLowConversion(referralStats({ no_interesado: 4 }))).toBeNull();
  });

  it("flags field:'rules' for a moderate low conversion rate (10-15%)", () => {
    const stats = referralStats({ convertido: 1, no_interesado: 9 }); // 10%
    const finding = detectLowConversion(stats);
    expect(finding).toMatchObject({ kind: "opportunity", field: "rules" });
  });

  it("flags field:'prompt' for a severe low conversion rate (<10%)", () => {
    const stats = referralStats({ convertido: 0, no_interesado: 10 }); // 0%
    const finding = detectLowConversion(stats);
    expect(finding).toMatchObject({ kind: "opportunity", field: "prompt" });
  });

  it("does not flag low conversion once the rate clears the threshold", () => {
    const stats = referralStats({ convertido: 2, no_interesado: 8 }); // 20%
    expect(detectLowConversion(stats)).toBeNull();
  });

  it("flags a strength for high conversion with enough volume", () => {
    const stats = referralStats({ convertido: 5, no_interesado: 5 }); // 50%
    const finding = detectHighConversion(stats);
    expect(finding).toMatchObject({ kind: "strength", field: null });
  });

  it("does not flag high conversion below the minimum volume", () => {
    const stats = referralStats({ convertido: 2 }); // 100% but only 2 referrals
    expect(detectHighConversion(stats)).toBeNull();
  });
});

describe("detectStalledReferrals", () => {
  it("flags a pattern when most referrals never leave nuevo/contactado", () => {
    const stats = referralStats({ nuevo: 4, contactado: 3, interesado: 1, convertido: 1 }); // 7/9 = 78%
    const finding = detectStalledReferrals(stats);
    expect(finding).toMatchObject({ kind: "pattern", field: null });
  });

  it("does not flag when the stall rate is under the threshold", () => {
    const stats = referralStats({ nuevo: 1, contactado: 1, interesado: 3, convertido: 3 }); // 2/8 = 25%
    expect(detectStalledReferrals(stats)).toBeNull();
  });
});

describe("detectSlowResponses / detectFastResponses", () => {
  it("flags slow responses over the threshold", () => {
    expect(detectSlowResponses(metrics({ avgLatencyMs: 9000 }))).toMatchObject({ kind: "pattern", field: null });
  });

  it("does not flag when latency is unknown", () => {
    expect(detectSlowResponses(metrics({ avgLatencyMs: null }))).toBeNull();
  });

  it("flags fast responses with enough conversation volume", () => {
    expect(detectFastResponses(metrics({ avgLatencyMs: 1500, conversationsHandled: 8 }))).toMatchObject({ kind: "strength" });
  });

  it("does not flag fast responses below the minimum conversation volume", () => {
    expect(detectFastResponses(metrics({ avgLatencyMs: 1500, conversationsHandled: 2 }))).toBeNull();
  });
});

describe("detectHighToolSuccess", () => {
  it("flags a strength when overall tool success rate is high", () => {
    const stats = [tool({ totalCalls: 8, executedCount: 8 }), tool({ toolId: "tool-2", totalCalls: 2, executedCount: 1, failedCount: 1 })];
    // 9/10 = 90%
    expect(detectHighToolSuccess(stats)).toMatchObject({ kind: "strength" });
  });

  it("does not flag below the minimum call volume", () => {
    expect(detectHighToolSuccess([tool({ totalCalls: 2, executedCount: 2 })])).toBeNull();
  });
});

describe("buildAgentFindings", () => {
  it("never invents a referral finding when referralStats is null (agent has no advisor_id)", () => {
    const findings = buildAgentFindings(metrics({ avgLatencyMs: 1000 }), [], null);
    expect(findings.every((f) => !f.id.includes("conversion") && !f.id.includes("stalled"))).toBe(true);
  });

  it("combines findings from every detector without duplicating ids", () => {
    const findings = buildAgentFindings(
      metrics({ avgLatencyMs: 9000, conversationsHandled: 10 }),
      [tool({ totalCalls: 5, executedCount: 1, failedCount: 4 })],
      referralStats({ convertido: 5, no_interesado: 5 }),
    );
    const ids = findings.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("failing-tool-tool-1");
    expect(ids).toContain("high-conversion");
    expect(ids).toContain("slow-responses");
  });
});
