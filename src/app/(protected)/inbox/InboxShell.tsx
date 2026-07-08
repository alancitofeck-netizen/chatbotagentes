"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { Sheet } from "@/components/ui/Sheet";
import type { ConversationDetail, ConversationListItem, WorkspaceMemberOption, WorkspaceTag } from "@/lib/inbox/queries";
import { getConversationDetailAction, getConversationListAction } from "@/lib/inbox/actions";
import { ConversationList } from "./ConversationList";
import { ConversationThread } from "./ConversationThread";
import { ContactInfoPanel } from "./ContactInfoPanel";

export function InboxShell({
  workspaceId,
  initialConversations,
  members,
  tags,
}: {
  workspaceId: string;
  initialConversations: ConversationListItem[];
  members: WorkspaceMemberOption[];
  tags: WorkspaceTag[];
}) {
  const [conversations, setConversations] = useState(initialConversations);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [infoSheetOpen, setInfoSheetOpen] = useState(false);
  const [, startTransition] = useTransition();
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function refetchList() {
    startTransition(async () => {
      const fresh = await getConversationListAction({ status: status || undefined, search: search || undefined });
      setConversations(fresh);
    });
  }

  // Re-run the list query whenever the status filter or (debounced) search changes.
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => {
      refetchList();
    }, 300);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search]);

  function loadDetail(id: string) {
    setSelectedId(id);
    setDetailLoading(true);
    getConversationDetailAction(id).then((d) => {
      setDetail(d);
      setDetailLoading(false);
    });
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
    const channel = supabase
      .channel(`conversations-${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `workspace_id=eq.${workspaceId}` },
        () => refetchList(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  return (
    <div className="flex h-full">
      <ConversationList
        conversations={conversations}
        selectedId={selectedId}
        onSelect={loadDetail}
        status={status}
        onStatusChange={setStatus}
        search={search}
        onSearchChange={setSearch}
        className={selectedId ? "hidden w-full border-r lg:flex lg:w-[320px]" : "flex w-full border-r lg:w-[320px]"}
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

      <div className="hidden w-[320px] shrink-0 border-l border-border-default lg:block">
        <ContactInfoPanel detail={detail} loading={detailLoading} members={members} tags={tags} onChanged={refetchDetail} />
      </div>

      <Sheet open={infoSheetOpen} onClose={() => setInfoSheetOpen(false)} title="Detalles" className="max-w-sm">
        <ContactInfoPanel detail={detail} loading={detailLoading} members={members} tags={tags} onChanged={refetchDetail} />
      </Sheet>
    </div>
  );
}
