"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { saveManychatSheetLink } from "@/lib/manychat/sheetLink";
import { extractSheetRef } from "@/lib/manychat/sheetSource";

export interface SheetLinkState {
  ok: boolean;
  error: string | null;
}

/** Guarda el link de la hoja de ManyChat. Sólo owner/admin pueden cambiarlo. */
export async function saveSheetLinkAction(_prev: SheetLinkState, formData: FormData): Promise<SheetLinkState> {
  const { workspaceId, role } = await requireActiveWorkspace();
  if (role !== "owner" && role !== "admin") return { ok: false, error: "Solo el owner o un admin pueden cambiar la hoja." };

  const url = String(formData.get("sheetUrl") ?? "").trim();
  if (!extractSheetRef(url)) return { ok: false, error: "Pegá el link de una hoja de Google Sheets." };

  const saved = await saveManychatSheetLink(workspaceId, url);
  if (!saved) return { ok: false, error: "No se pudo guardar la hoja. Probá de nuevo." };

  revalidatePath("/manychat");
  return { ok: true, error: null };
}
