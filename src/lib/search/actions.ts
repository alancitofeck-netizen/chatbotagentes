"use server";

import { requireActiveWorkspace } from "@/lib/auth/session";
import { searchGlobal } from "@/lib/search/service";
import type { SearchResult } from "@/lib/search/types";

export async function globalSearchAction(query: string): Promise<SearchResult[]> {
  const { workspaceId } = await requireActiveWorkspace();
  return searchGlobal(workspaceId, query);
}
