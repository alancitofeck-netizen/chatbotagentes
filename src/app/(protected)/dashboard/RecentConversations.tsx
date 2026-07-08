import { MessageSquare } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { RecentConversation } from "@/lib/dashboard/queries";

const STATUS_LABEL: Record<string, { label: string; variant: "accent" | "warning" | "neutral" }> = {
  open: { label: "Abierta", variant: "accent" },
  pending_human: { label: "Esperando", variant: "warning" },
  closed: { label: "Cerrada", variant: "neutral" },
};

function formatRelative(iso: string | null) {
  if (!iso) return "";
  const diffMin = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `hace ${diffH} h`;
  return `hace ${Math.round(diffH / 24)} d`;
}

export function RecentConversations({ conversations }: { conversations: RecentConversation[] }) {
  return (
    <Card>
      <CardHeader title="Últimas conversaciones" />
      {conversations.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Sin conversaciones todavía" />
      ) : (
        <ul className="flex flex-col gap-1">
          {conversations.map((c) => {
            const status = STATUS_LABEL[c.status] ?? STATUS_LABEL.open;
            return (
              <li key={c.id} className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-surface-2">
                <Avatar name={c.contactName} src={c.avatarUrl} size={36} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{c.contactName}</span>
                    <span className="shrink-0 text-xs text-neutral-500">{formatRelative(c.lastMessageAt)}</span>
                  </div>
                  <p className="truncate text-[13px] text-neutral-500">{c.lastMessagePreview}</p>
                </div>
                <Badge variant={status.variant} className="shrink-0">
                  {status.label}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
