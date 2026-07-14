import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { embed, getOpenRouterCredentials } from "@/lib/integrations/openrouter";

/**
 * RAG pipeline for "Base de conocimiento" (Agentes IA) — entirely absent
 * from docs/blueprint/*.md, a genuine extension confirmed with the user.
 * Text extraction scope this round: TXT/CSV/MD (trivial) and real PDF
 * extraction (via `unpdf`, chosen over `pdf-parse` for this serverless
 * stack). DOCX/XLSX are explicitly deferred (not attempted, not silently
 * skipped — surfaced as a distinct failure reason). Google Docs/Sheets are
 * impossible this round (no Google Drive OAuth exists anywhere yet).
 */

const CHUNK_SIZE = 900;
const CHUNK_OVERLAP = 100;
const TOP_K = 5;

function chunkText(text: string): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + CHUNK_SIZE, clean.length);
    chunks.push(clean.slice(start, end));
    if (end === clean.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

async function extractText(mimeType: string | null, fileName: string, buffer: Buffer): Promise<string | null> {
  const lowerName = fileName.toLowerCase();
  const mt = mimeType ?? "";

  if (mt.startsWith("text/") || /\.(txt|csv|md)$/.test(lowerName)) {
    return buffer.toString("utf-8");
  }

  if (mt === "application/pdf" || lowerName.endsWith(".pdf")) {
    const { getDocumentProxy, extractText: extractPdfText } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractPdfText(pdf, { mergePages: true });
    return text;
  }

  // DOCX/XLSX/images/etc: deferred this round, not attempted.
  return null;
}

/**
 * Runs synchronously inside the attach action (src/lib/ai-agents/actions.ts) —
 * no worker/queue infra exists beyond the single Vercel Cron already used
 * for the buffer flush, and per-agent knowledge bases are expected to be a
 * handful of documents, not bulk uploads. A very large PDF could approach a
 * serverless function timeout — a known v1 scale limit, not solved here.
 */
export async function ingestKnowledgeDocument(agentId: string, documentId: string, workspaceId: string): Promise<void> {
  const supabase = createServiceRoleClient();

  async function fail(reason: string) {
    await supabase.from("agent_knowledge_base").update({ status: "failed", error: reason }).eq("agent_id", agentId).eq("document_id", documentId);
  }

  const { data: doc } = await supabase
    .from("documents")
    .select("name, mime_type, storage_path, source")
    .eq("id", documentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!doc) return fail("document_not_found");

  if (doc.source === "google_docs" || doc.source === "google_sheets") {
    return fail("google_docs_not_supported_yet");
  }

  try {
    const { data: fileData, error: downloadError } = await supabase.storage.from("documents").download(doc.storage_path as string);
    if (downloadError || !fileData) throw new Error("download_failed");
    const buffer = Buffer.from(await fileData.arrayBuffer());

    const text = await extractText(doc.mime_type as string | null, doc.name as string, buffer);
    if (!text || !text.trim()) {
      await fail("unsupported_or_empty_file");
      return;
    }

    const credentials = await getOpenRouterCredentials(supabase, workspaceId);
    if (!credentials) throw new Error("openrouter_not_configured");

    const chunks = chunkText(text);

    // Re-ingestion (retry after failure, or re-attaching): clear any
    // previous chunks for this document first.
    await supabase.from("document_chunks").delete().eq("document_id", documentId);

    for (let i = 0; i < chunks.length; i++) {
      const embedding = await embed(credentials.apiKey, chunks[i]);
      const { error: insertError } = await supabase.from("document_chunks").insert({
        document_id: documentId,
        workspace_id: workspaceId,
        chunk_index: i,
        content: chunks[i],
        embedding: JSON.stringify(embedding),
      });
      if (insertError) throw new Error(`chunk_insert_failed: ${insertError.message}`);
    }

    await supabase.from("agent_knowledge_base").update({ status: "ready", error: null }).eq("agent_id", agentId).eq("document_id", documentId);
  } catch (err) {
    console.error(`[knowledgeBase] ingestion failed for document ${documentId}:`, err);
    await fail(err instanceof Error ? err.message : "ingestion_failed");
  }
}

/** Called from agentRuntime.ts::buildContext — returns [] (never throws)
 * whenever there's nothing to retrieve or the embedding call itself fails,
 * so a knowledge-base hiccup never blocks a reply the agent could otherwise
 * give using its normal context. */
export async function retrieveKnowledgeContext(
  supabase: SupabaseClient,
  agentId: string,
  apiKey: string,
  queryText: string,
): Promise<string[]> {
  const { count } = await supabase
    .from("agent_knowledge_base")
    .select("*", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("status", "ready");
  if (!count) return [];

  let queryEmbedding: number[];
  try {
    queryEmbedding = await embed(apiKey, queryText);
  } catch (err) {
    console.error("[knowledgeBase] failed to embed query — skipping retrieval:", err);
    return [];
  }

  const { data, error } = await supabase.rpc("match_agent_knowledge_chunks", {
    p_agent_id: agentId,
    p_query_embedding: JSON.stringify(queryEmbedding),
    p_match_count: TOP_K,
  });
  if (error) {
    console.error("[knowledgeBase] retrieval query failed:", error);
    return [];
  }

  return (data ?? []).map((row: { content: string }) => row.content);
}
