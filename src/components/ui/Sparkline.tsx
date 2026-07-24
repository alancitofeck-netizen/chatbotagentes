"use client";

import { Line, LineChart, ResponsiveContainer } from "recharts";

/** Tiny inline trend line — shared by AgentsList.tsx (per-agent activity)
 * and PlatformWorkspacesTable.tsx (per-workspace conversation trend), was
 * duplicated as a private function in both before this extraction. */
export function Sparkline({
  data,
  color,
  width = 64,
  height = 32,
}: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  const points = data.map((v, i) => ({ i, v }));
  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points}>
          <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
