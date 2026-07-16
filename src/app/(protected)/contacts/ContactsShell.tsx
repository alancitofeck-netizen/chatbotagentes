"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import type { CompanyGroup, ContactDetail, ContactListItem } from "@/lib/contacts/queries";
import type { WorkspaceTag } from "@/lib/inbox/queries";
import { getCompanyGroupsAction, getContactDetailAction, getContactListAction } from "@/lib/contacts/actions";
import { ContactList } from "./ContactList";
import { CompanyList } from "./CompanyList";
import { ContactDetailPanel } from "./ContactDetailPanel";
import { CreateContactForm } from "./CreateContactForm";

export function ContactsShell({
  workspaceId,
  initialContacts,
  initialCompanies,
  tags,
}: {
  workspaceId: string;
  initialContacts: ContactListItem[];
  initialCompanies: CompanyGroup[];
  tags: WorkspaceTag[];
}) {
  const [tab, setTab] = useState<"contactos" | "empresas">("contactos");
  const [contacts, setContacts] = useState(initialContacts);
  const [companies, setCompanies] = useState(initialCompanies);
  const [search, setSearch] = useState("");
  const [optStatus, setOptStatus] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ContactDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [, startTransition] = useTransition();
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function refetchList() {
    startTransition(async () => {
      const fresh = await getContactListAction({
        search: search || undefined,
        company: companyFilter || undefined,
        optStatus: optStatus || undefined,
      });
      setContacts(fresh);
    });
  }

  function refetchCompanies() {
    startTransition(async () => {
      setCompanies(await getCompanyGroupsAction());
    });
  }

  // Re-run the list query whenever a filter changes, debounced like InboxShell.
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    searchDebounce.current = setTimeout(() => refetchList(), 300);
    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, optStatus, companyFilter]);

  function loadDetail(id: string) {
    setSelectedId(id);
    setDetailLoading(true);
    getContactDetailAction(id).then((d) => {
      setDetail(d);
      setDetailLoading(false);
    });
  }

  function refetchDetail() {
    if (!selectedId) return;
    getContactDetailAction(selectedId).then(setDetail);
    refetchList();
    refetchCompanies();
  }

  // Same Realtime pattern as InboxShell (src/app/(protected)/inbox/InboxShell.tsx)
  // — supabase/migrations/0005_contacts_realtime.sql adds `contacts` to the publication.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // `createBrowserClient` (@supabase/ssr) hydrates the session from cookies
    // asynchronously — subscribing immediately joins the Realtime socket
    // before the user's JWT is attached, so Postgres RLS sees an anonymous
    // connection and silently filters out every change (join still succeeds,
    // "Subscribed to PostgreSQL" still fires, but no event ever arrives).
    // Explicitly awaiting the session + setAuth before subscribing fixes it.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled || !session) return;
      supabase.realtime.setAuth(session.access_token);
      channel = supabase
        .channel(`contacts-${workspaceId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "contacts", filter: `workspace_id=eq.${workspaceId}` },
          () => {
            refetchList();
            refetchCompanies();
          },
        )
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  function handleSelectCompany(company: string) {
    setCompanyFilter(company);
    setTab("contactos");
  }

  function handleCreated(id: string) {
    refetchList();
    refetchCompanies();
    loadDetail(id);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4 border-b border-border-default px-6 py-4">
        <div>
          <h1 className="text-[17px] font-semibold text-foreground">Contactos</h1>
          <Tabs value={tab} onValueChange={(v) => setTab(v as "contactos" | "empresas")} className="mt-2">
            <TabsList>
              <TabsTrigger value="contactos">Contactos</TabsTrigger>
              <TabsTrigger value="empresas">Empresas</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus size={15} aria-hidden="true" />
          Nuevo contacto
        </Button>
      </div>

      {companyFilter && tab === "contactos" && (
        <div className="flex items-center gap-2 border-b border-border-default bg-surface-2 px-6 py-2 text-sm">
          <span className="text-neutral-500">Filtrando por empresa:</span>
          <span className="font-medium text-foreground">{companyFilter}</span>
          <button
            type="button"
            onClick={() => setCompanyFilter("")}
            className="ml-1 text-xs text-accent-600 hover:underline"
          >
            Quitar filtro
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {tab === "contactos" ? (
          <ContactList
            contacts={contacts}
            search={search}
            onSearchChange={setSearch}
            optStatus={optStatus}
            onOptStatusChange={setOptStatus}
            onSelect={loadDetail}
          />
        ) : (
          <CompanyList companies={companies} onSelectCompany={handleSelectCompany} />
        )}
      </div>

      <Sheet
        open={selectedId !== null}
        onClose={() => setSelectedId(null)}
        title={detail?.name ?? "Detalle del contacto"}
      >
        <ContactDetailPanel
          // Remount on the loading→loaded transition (not just on selectedId)
          // so the editable field state below initializes from the real
          // `detail` instead of freezing at the empty values it mounted
          // with while the fetch was still in flight.
          key={`${selectedId ?? "closed"}-${detailLoading ? "loading" : "ready"}`}
          detail={detail}
          loading={detailLoading}
          tags={tags}
          onChanged={refetchDetail}
        />
      </Sheet>

      <CreateContactForm open={createOpen} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />
    </div>
  );
}
