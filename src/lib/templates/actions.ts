"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireActiveWorkspace } from "@/lib/auth/session";
import { requireManagerRole } from "@/lib/auth/roles";
import { getYCloudCredentials, createYCloudTemplate, deleteYCloudTemplate } from "@/lib/integrations/ycloud";
import type { YCloudTemplateComponent } from "@/lib/integrations/ycloud";

const NAME_PATTERN = /^[a-z0-9_]{1,512}$/;

export interface CreateTemplateInput {
  wabaId: string;
  name: string;
  language: string;
  category: "AUTHENTICATION" | "MARKETING" | "UTILITY";
  bodyText: string;
  footerText?: string;
}

/** Gated (unlike Etiquetas' create/rename) — a template is workspace-wide
 * config that represents the business to Meta/WhatsApp, same posture as
 * src/lib/integrations/actions.ts and src/lib/settings/actions.ts, matching
 * the whatsapp_templates_insert RLS policy (owner/admin only). */
export async function createTemplate(input: CreateTemplateInput) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);

  if (!NAME_PATTERN.test(input.name)) {
    throw new Error("El nombre debe usar solo minúsculas, números y guion bajo (ej. confirmacion_pedido).");
  }
  if (!input.bodyText.trim()) {
    throw new Error("El cuerpo del mensaje es obligatorio.");
  }
  if (!input.wabaId.trim()) {
    throw new Error("El WABA ID es obligatorio (lo encontrás en tu dashboard de YCloud).");
  }

  const credentials = await getYCloudCredentials(createServiceRoleClient(), workspaceId);
  if (!credentials) {
    throw new Error("No hay una conexión de WhatsApp (YCloud) configurada para este workspace.");
  }

  const components: YCloudTemplateComponent[] = [{ type: "BODY", text: input.bodyText.trim() }];
  if (input.footerText?.trim()) {
    components.push({ type: "FOOTER", text: input.footerText.trim() });
  }

  const result = await createYCloudTemplate(credentials, {
    wabaId: input.wabaId.trim(),
    name: input.name,
    language: input.language,
    category: input.category,
    components,
  });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("whatsapp_templates")
    .insert({
      workspace_id: workspaceId,
      ycloud_template_id: result.id,
      name: input.name,
      language: input.language,
      category: input.category,
      components,
      status: result.status.toLowerCase() === "approved" ? "approved" : "pending",
      waba_id: input.wabaId.trim(),
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") throw new Error("Ya existe una plantilla con ese nombre e idioma.");
    throw new Error("La plantilla se creó en YCloud pero no se pudo guardar localmente.");
  }

  revalidatePath("/inbox/plantillas");
  return { id: data.id as string };
}

export async function deleteTemplate(templateId: string) {
  const { workspaceId, role } = await requireActiveWorkspace();
  requireManagerRole(role);
  const supabase = await createClient();

  const { data: template } = await supabase
    .from("whatsapp_templates")
    .select("ycloud_template_id")
    .eq("id", templateId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!template) throw new Error("Plantilla no encontrada en este workspace.");

  const credentials = await getYCloudCredentials(createServiceRoleClient(), workspaceId);
  if (credentials) {
    await deleteYCloudTemplate(credentials, template.ycloud_template_id as string);
  }

  const { error } = await supabase.from("whatsapp_templates").delete().eq("id", templateId).eq("workspace_id", workspaceId);
  if (error) throw new Error("No se pudo eliminar la plantilla.");

  revalidatePath("/inbox/plantillas");
}
