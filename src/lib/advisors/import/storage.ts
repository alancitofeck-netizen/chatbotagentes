import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import type { ParsedTable } from "./parseFile";

/** Private bucket (0056_import_jobs.sql) — no storage.objects policy for
 * anon/authenticated at all, so every read/write here goes through the
 * service-role client, same posture as the whatsapp-web-sessions bucket
 * (0052_whatsapp_web_remoteauth_store.sql). Holds two objects per job for
 * the wizard's lifetime: the original uploaded bytes (kept in case a
 * multi-sheet file needs re-parsing after Paso 1's sheet choice) and a
 * parsed.json cache of the currently-active parsed table, so Paso 3-6's
 * several round trips don't need the client to re-upload the file or the
 * server to re-parse it each time. */
const BUCKET = "cartera_imports";

export async function uploadImportSourceFile(jobId: string, buffer: ArrayBuffer, fileName: string): Promise<string> {
  const path = `${jobId}/source_${fileName}`;
  const service = createServiceRoleClient();
  const { error } = await service.storage.from(BUCKET).upload(path, buffer, { upsert: true });
  if (error) throw new Error("No se pudo guardar el archivo en el servidor.");
  return path;
}

export async function downloadImportSourceFile(storagePath: string): Promise<ArrayBuffer> {
  const service = createServiceRoleClient();
  const { data, error } = await service.storage.from(BUCKET).download(storagePath);
  if (error || !data) throw new Error("No se pudo leer el archivo original.");
  return data.arrayBuffer();
}

export async function saveParsedTable(jobId: string, table: ParsedTable): Promise<void> {
  const service = createServiceRoleClient();
  const { error } = await service.storage
    .from(BUCKET)
    .upload(`${jobId}/parsed.json`, JSON.stringify(table), { upsert: true, contentType: "application/json" });
  if (error) throw new Error("No se pudo guardar los datos leídos del archivo.");
}

export async function loadParsedTable(jobId: string): Promise<ParsedTable> {
  const service = createServiceRoleClient();
  const { data, error } = await service.storage.from(BUCKET).download(`${jobId}/parsed.json`);
  if (error || !data) throw new Error("No se pudo leer los datos del archivo — volvé a subirlo.");
  return JSON.parse(await data.text()) as ParsedTable;
}
