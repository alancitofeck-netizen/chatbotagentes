"use client";

import { motion } from "framer-motion";
import { Rocket, Award, Medal, Trophy, Star, Flame, Gem, Crown, Lock, type LucideIcon } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { ACHIEVEMENT_CATALOG, TIER_COLOR, type AchievementDef } from "@/lib/goals/constants";

const ICONS: Record<AchievementDef["icon"], LucideIcon> = { Rocket, Award, Medal, Trophy, Star, Flame, Gem, Crown };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" });
}

export function AchievementsGrid({ unlocked }: { unlocked: { key: string; unlockedAt: string }[] }) {
  const unlockedByKey = new Map(unlocked.map((u) => [u.key, u.unlockedAt]));

  return (
    <Card>
      <CardHeader title="Logros" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {ACHIEVEMENT_CATALOG.map((a, i) => {
          const Icon = ICONS[a.icon];
          const unlockedAt = unlockedByKey.get(a.key);
          const isUnlocked = Boolean(unlockedAt);
          const colors = TIER_COLOR[a.tier];

          return (
            <motion.div
              key={a.key}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, delay: i * 0.03, ease: "easeOut" }}
              title={isUnlocked ? `${a.description} · ${formatDate(unlockedAt!)}` : `${a.description} (bloqueado)`}
              className={cn(
                "flex flex-col items-center gap-2 rounded-lg p-3 text-center transition-opacity",
                isUnlocked ? cn("ring-1", colors.bg, colors.ring) : "bg-surface-2 opacity-50 grayscale",
              )}
            >
              <span className={cn("flex size-11 items-center justify-center rounded-full", isUnlocked ? "bg-surface-1" : "bg-surface-3")}>
                {isUnlocked ? <Icon className={cn("size-5", colors.text)} aria-hidden="true" /> : <Lock className="size-4 text-neutral-400" aria-hidden="true" />}
              </span>
              <p className="text-[11px] font-medium leading-tight text-foreground">{a.name}</p>
            </motion.div>
          );
        })}
      </div>
    </Card>
  );
}
