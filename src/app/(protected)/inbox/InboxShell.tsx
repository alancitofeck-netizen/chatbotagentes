"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sheet } from "@/components/ui/Sheet";
import type { ConversationDetail, ConversationListItem, WorkspaceMemberOption, WorkspaceTag } from "@/lib/inbox/queries";
import { getConversationDetailAction, getConversationListAction, markConversationRead } from "@/lib/inbox/actions";
import { ConversationList, type InboxTab } from "./ConversationList";
import { ConversationThread } from "./ConversationThread";
import { ContactInfoPanel } from "./ContactInfoPanel";

export function InboxShell({
  workspaceId,
  currentMemberId,
  initialConversations,
  members,
  tags,
}: {
  workspaceId: string;
  currentMemberId: string | null;
  initialConversations: ConversationListItem[];
  members: WorkspaceMemberOption[];
  tags: WorkspaceTag[];
}) {
  const [conversations, setConversations] = useState(initialConversations);
  // Tabs (Todas/No leídas/Asignadas/Cerradas) are filtered client-side over
  // the same fetched list — only the text search still round-trips to the
  // server (unchanged debounced pattern), since status is no longer the
  // server-side filter dimension.
  const [activeTab, setActiveTab] = useState<InboxTab>("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [infoSheetOpen, setInfoSheetOpen] = useState(false);
  const [, startTransition] = useTransition();
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function refetchList() {
    startTransition(async () => {
      const fresh = await getConversationListAction({ search: search || undefined });
      setConversations(fresh);
    });
  }

  // Re-run the list query whenever the (debounced) search changes.
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      refetchList();
    }, 300);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function loadDetail(id: string) {
    setSelectedId(id);
    setDetailLoading(true);
    getConversationDetailAction(id).then((d) => {
      setDetail(d);
      setDetailLoading(false);
    });
    // Optimistically clear the unread badge — don't wait for the round trip.
    setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
    markConversationRead(id);
  }

  function refetchDetail() {
    if (!selectedId) return;
    getConversationDetailAction(selectedId).then(setDetail);
    refetchList();
  }

  // First Realtime usage in the project (supabase/migrations/0003_inbox.sql adds
  // `conversations` to the publication) — any insert/update in this workspace's
  // conversations refetches the list so new leads/status changes show up live.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // `createBrowserClient` (@supabase/ssr) hydrates the session from cookies
    // asynchronously — subscribing immediately joins the Realtime socket
    // before the user's JWT is attached, so Postgres RLS sees an anonymous
    // connection and silently filters out every change (join still succeeds,
    // "Subscribed to PostgreSQL" still fires, but no event ever arrives).
    // Explicitly awaiting the session + setAuth before subscribing fixes it
    // (confirmed live via WS-frame instrumentation — see the same fix in
    // src/app/(protected)/contacts/ContactsShell.tsx).
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session) return;
      supabase.realtime.setAuth(session.access_token);
      channel = supabase
        .channel(`conversations-${workspaceId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "conversations", filter: `workspace_id=eq.${workspaceId}` },
          () => refetchList(),
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  return (
    <div className="flex h-full bg-surface-2">
      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        onSelect={loadDetail}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        currentMemberId={currentMemberId}
        members={members}
        search={search}
        onSearchChange={setSearch}
        className={selectedId ? "hidden w-full border-r lg:flex lg:w-[360px]" : "flex w-full border-r lg:w-[360px]"}
      />

      <div className={selectedId ? "flex flex-1" : "hidden flex-1 lg:flex"}>
        <ConversationThread
          key={selectedId ?? "empty"}
          detail={detail}
          loading={detailLoading}
          onOpenInfo={() => setInfoSheetOpen(true)}
          onBack={() => setSelectedId(null)}
        />
      </div>

      <div className="hidden w-[340px] shrink-0 border-l border-border-default lg:block">
        <ContactInfoPanel detail={detail} loading={detailLoading} members={members} tags={tags} onChanged={refetchDetail} />
      </div>

      <Sheet open={infoSheetOpen} onClose={() => setInfoSheetOpen(false)} title="Detalles" className="max-w-sm">
        <ContactInfoPanel detail={detail} loading={detailLoading} members={members} tags={tags} onChanged={refetchDetail} />
      </Sheet>
    </div>
  );
}
