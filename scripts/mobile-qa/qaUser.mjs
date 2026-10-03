import fs from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

export const QA_EMAIL = "qa-mobile@example.com";
export const QA_ADMIN_EMAIL = "qa-mobile-admin@example.com";
export const QA_WORKSPACE_ID = "e7c8ae59-c10b-462f-87cf-bd69d44b32fd";

function readEnv() {
  const env = fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
  const get = (key) => {
    const m = env.match(new RegExp(`^${key}=(.*)$`, "m"));
    if (!m) throw new Error(`Falta ${key} en .env.local`);
    return m[1].trim();
  };
  return { url: get("NEXT_PUBLIC_SUPABASE_URL"), serviceKey: get("SUPABASE_SERVICE_ROLE_KEY") };
}

/** Crea la cuenta si no existe y le rota la contraseña en cada corrida. La
 * contraseña vive solo en memoria del proceso — nunca se escribe a disco. */
async function ensureUserAndPassword(email, { isAdmin }) {
  const { url, serviceKey } = readEnv();
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  const password = crypto.randomBytes(18).toString("base64url") + "Aa1!";

  const { data: list, error: listErr } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listErr) throw listErr;
  let user = list.users.find((u) => u.email === email);
  if (user) {
    const { error } = await db.auth.admin.updateUserById(user.id, { password, email_confirm: true });
    if (error) throw error;
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: isAdmin ? "QA Mobile Admin" : "QA Mobile" },
    });
    if (error) throw error;
    user = data.user;
  }

  if (isAdmin) {
    const { data: existing } = await db
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", QA_WORKSPACE_ID)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!existing) {
      const { error } = await db.from("workspace_members").insert({ workspace_id: QA_WORKSPACE_ID, user_id: user.id, role: "admin" });
      if (error) throw error;
    }
  }
  return { email, password };
}

export function ensureQaUserAndPassword() {
  return ensureUserAndPassword(QA_EMAIL, { isAdmin: false });
}

/** Cuenta admin: membresía "admin" solo en el workspace QA, así no se le
 * aprovisiona un workspace personal propio. */
export function ensureQaAdminUserAndPassword() {
  return ensureUserAndPassword(QA_ADMIN_EMAIL, { isAdmin: true });
}
