import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { diceCoefficient, normalizeForMatch } from "@/lib/advisors/import/fuzzyMatch";
import { findOrCreateContact } from "@/lib/contacts/match";
import { ensurePolicyPipeline, type InsuranceType } from "@/lib/policies/queries";
import { POLICY_FIELD_DICTIONARY } from "@/lib/policies/constants";
import { logActivity } from "@/lib/activity/log";

export { POLICY_FIELD_DICTIONARY };

const MATCH_THRESHOLD = 0.6;

/** Mismo algoritmo de dos pasadas que detectColumnMapping (Asesores):
 * coincidencia exacta primero, después mejor puntaje por Dice's coefficient
 * — nunca bloquea el import, lo que no matchea vuelve con fieldKey: null
 * para que el usuario lo mapee a mano. */
export function detectPolicyColumnMapping(headers: string[]): { header: string; fieldKey: string | null }[] {
  const results = new Map<string, string | null>(headers.map((h) => [h, null]));
  const claimedFields = new Set<string>();
  const unmatched = new Set<string>(headers);

  for (const header of headers) {
    const normalized = normalizeForMatch(header);
    const exact = POLICY_FIELD_DICTIONARY.find(
      (f) => !claimedFields.has(f.key) && f.synonyms.some((syn) => normalizeForMatch(syn) === normalized),
    );
    if (exact) {
      results.set(header, exact.key);
      claimedFields.add(exact.key);
      unmatched.delete(header);
    }
  }

  const candidates: { header: string; fieldKey: string; score: number }[] = [];
  for (const header of unmatched) {
    for (const field of POLICY_FIELD_DICTIONARY) {
      if (claimedFields.has(field.key)) continue;
      const best = Math.max(...field.synonyms.map((syn) => diceCoefficient(header, syn)));
      if (best >= MATCH_THRESHOLD) candidates.push({ header, fieldKey: field.key, score: best });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const assigned = new Set<string>();
  for (const c of candidates) {
    if (assigned.has(c.header) || claimedFields.has(c.fieldKey)) continue;
    results.set(c.header, c.fieldKey);
    claimedFields.add(c.fieldKey);
    assigned.add(c.header);
  }

  return headers.map((h) => ({ header: h, fieldKey: results.get(h) ?? null }));
}

const INSURANCE_TYPE_SYNONYMS: Record<InsuranceType, string[]> = {
  auto: ["auto", "automovil", "automóvil", "vehiculo", "vehículo", "car"],
  hogar: ["hogar", "vivienda", "casa", "home"],
  vida: ["vida", "life"],
  otro: [],
};

function normalizeInsuranceType(raw: string | undefined): InsuranceType {
  if (!raw) return "otro";
  const normalized = raw.trim().toLowerCase();
  for (const [key, synonyms] of Object.entries(INSURANCE_TYPE_SYNONYMS)) {
    if (synonyms.some((s) => normalized.includes(s))) return key as InsuranceType;
  }
  return "otro";
}

/** YYYY-MM-DD, DD/MM/YYYY o un serial de fecha de Excel ya convertido a
 * string por parseFile.ts (cellToString castea Date a YYYY-MM-DD, así que
 * esto solo hace falta para celdas que llegaron como texto suelto). */
function normalizeDate(raw: string | undefined): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const dmy = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function normalizeNumber(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const cleaned = raw.replace(/[^0-9.,-]/g, "").replace(/\.(?=\d{3},)/g, "").replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export interface PolicyImportResult {
  created: number;
  errors: { row: number; message: string }[];
}

/** Corre síncrono (no job en background como el importador de Asesores) —
 * el volumen esperado para Pólizas es el de una carga puntual desde
 * Configuración, no "migrar toda la cartera histórica" (ese caso, si llega
 * a hacer falta, es un job aparte a construir cuando el volumen real lo
 * justifique). Cada fila corre en su propio try/catch — un error no aborta
 * el resto, mismo criterio "nunca falla del todo" que el resto del proyecto. */
export async function importPolicyRows(
  workspaceId: string,
  memberId: string | null,
  rows: Record<string, string>[],
  mapping: Record<string, string | null>,
  defaultOwnerId: string | null,
  /** Cuando el import viene de Conexión con Aseguradoras (carga manual) en
   * vez del importador genérico de Pólizas — se estampa en cada póliza
   * creada para que "pólizas sincronizadas" en esa tarjeta sea un COUNT
   * real, no un número aparte a mantener. */
  insuranceConnectionId: string | null = null,
): Promise<PolicyImportResult> {
  const supabase = await createClient();
  const service = createServiceRoleClient();

  const pipelineId = await ensurePolicyPipeline(workspaceId);
  const { data: firstStage } = await supabase.from("pipeline_stages").select("id").eq("pipeline_id", pipelineId).order("position", { ascending: true }).limit(1).maybeSingle();

  const { data: memberNames } = await supabase.rpc("workspace_member_names", { ws_id: workspaceId });
  const memberIdByName = new Map(
    ((memberNames ?? []) as { member_id: string; full_name: string }[]).map((m) => [m.full_name.trim().toLowerCase(), m.member_id]),
  );

  function field(row: Record<string, string>, key: string): string | undefined {
    const header = Object.keys(mapping).find((h) => mapping[h] === key);
    return header ? row[header] : undefined;
  }

  const result: PolicyImportResult = { created: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // +1 por índice 0-based, +1 por la fila de encabezado
    try {
      const company = field(row, "company")?.trim();
      if (!company) throw new Error("Falta la aseguradora.");

      const contactName = field(row, "contactName");
      const contactPhone = field(row, "contactPhone");
      const contactEmail = field(row, "contactEmail");
      if (!contactName?.trim() && !contactPhone?.trim() && !contactEmail?.trim()) {
        throw new Error("Falta el cliente (nombre, teléfono o email).");
      }

      const contactId = await findOrCreateContact(supabase, workspaceId, { name: contactName, phone: contactPhone, email: contactEmail }, "import");

      const ownerName = field(row, "ownerName")?.trim().toLowerCase();
      const ownerId = (ownerName ? memberIdByName.get(ownerName) : undefined) ?? defaultOwnerId;

      const { data: policy, error: policyError } = await supabase
        .from("policies")
        .insert({
          workspace_id: workspaceId,
          contact_id: contactId,
          owner_id: ownerId,
          created_by: memberId,
          policy_number: field(row, "policyNumber")?.trim() || null,
          company,
          product: field(row, "product")?.trim() || null,
          insurance_type: normalizeInsuranceType(field(row, "insuranceType")),
          status: "activa",
          start_date: normalizeDate(field(row, "startDate")),
          end_date: normalizeDate(field(row, "endDate")),
          premium: normalizeNumber(field(row, "premium")),
          premium_currency: field(row, "premiumCurrency")?.trim() || "USD",
          payment_frequency: field(row, "paymentFrequency")?.trim() || null,
          commission_amount: normalizeNumber(field(row, "commissionAmount")),
          source: "import",
          insurance_connection_id: insuranceConnectionId,
        })
        .select("id")
        .single();
      if (policyError || !policy) throw new Error(policyError?.message ?? "No se pudo crear la póliza.");

      if (firstStage) {
        const { data: item } = await service
          .from("pipeline_items")
          .insert({ pipeline_id: pipelineId, stage_id: firstStage.id, item_type: "policy", item_id: policy.id, position: 0 })
          .select("id")
          .single();
        if (item) await supabase.from("policies").update({ pipeline_item_id: item.id }).eq("id", policy.id as string);
      }

      await logActivity(supabase, workspaceId, memberId, "policy", policy.id as string, "policy_created", { source: "import" });
      result.created++;
    } catch (err) {
      result.errors.push({ row: rowNumber, message: err instanceof Error ? err.message : "Error desconocido." });
    }
  }

  return result;
}
