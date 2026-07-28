import type { Metadata } from "next";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { getCompanyGroups, getContactList } from "@/lib/contacts/queries";
import { getWorkspaceTags } from "@/lib/inbox/queries";
import { getMiniAppsList } from "@/lib/miniApps/queries";
import { ContactsShell } from "./ContactsShell";

export const metadata: Metadata = {
  title: "Contactos — Growth Link",
};

export default async function ContactsPage() {
  const { workspaceId } = await requireActiveWorkspace();

  const [contacts, companies, tags, miniApps] = await Promise.all([
    getContactList(workspaceId),
    getCompanyGroups(workspaceId),
    getWorkspaceTags(workspaceId),
    getMiniAppsList(workspaceId),
  ]);

  return (
    <ContactsShell
      workspaceId={workspaceId}
      initialContacts={contacts}
      initialCompanies={companies}
      tags={tags}
      miniApps={miniApps}
    />
  );
}
