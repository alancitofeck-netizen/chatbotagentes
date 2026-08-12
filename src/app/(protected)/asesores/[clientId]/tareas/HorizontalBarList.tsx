import { Card, CardHeader } from "@/components/ui/Card";

export function HorizontalBarList({
  title,
  items,
  defaultColor = "var(--color-accent-500)",
}: {
  title: string;
  items: { label: string; value: number; color?: string }[];
  defaultColor?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <Card>
      <CardHeader title={title} />
      {items.length === 0 ? (
        <p className="text-sm text-neutral-500">Sin datos todavía.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-xs text-neutral-500">{item.label}</span>
              <div className="h-2 flex-1 rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(4, Math.round((item.value / max) * 100))}%`, background: item.color ?? defaultColor }}
                />
              </div>
              <span className="w-6 shrink-0 text-right font-mono text-xs text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
