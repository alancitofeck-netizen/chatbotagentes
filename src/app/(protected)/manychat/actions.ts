"use server";

import { revalidatePath } from "next/cache";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { saveManychatSheetLink } from "@/lib/manychat/sheetLink";
import { extractSheetRef } from "@/lib/manychat/sheetSource";

export interface SheetLinkState {
  ok: boolean;
  error: string | null;
}

/** Guarda el link de la hoja de ManyChat. Owner, admin o agent (el asesor administra su propio
 * workspace, igual que sus integraciones de Google); nunca en modo supervisor. */
export async function saveSheetLinkAction(_prev: SheetLinkState, formData: FormData): Promise<SheetLinkState> {
  const { workspaceId, role, isSupervising } = await requireActiveWorkspace();
  if (isSupervising) return { ok: false, error: "Modo supervisor: no podés modificar un workspace que no es el tuyo." };
  if (role !== "owner" && role !== "admin" && role !== "agent") return { ok: false, error: "No tenés permiso para cambiar la hoja." };

  const url = String(formData.get("sheetUrl") ?? "").trim();
  if (!extractSheetRef(url)) return { ok: false, error: "Pegá el link de una hoja de Google Sheets." };

  const saved = await saveManychatSheetLink(workspaceId, url);
  if (!saved) return { ok: false, error: "No se pudo guardar la hoja. Probá de nuevo." };

  revalidatePath("/manychat");
  return { ok: true, error: null };
}
