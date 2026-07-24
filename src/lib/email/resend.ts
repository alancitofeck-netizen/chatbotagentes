import "server-only";
import { Resend } from "resend";

let client: Resend | null = null;

function getResendClient(): Resend {
  if (!client) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY no está configurada.");
    client = new Resend(apiKey);
  }
  return client;
}

function codeEmailHtml(code: string, heading: string, bodyLine: string): string {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:32px 16px;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
    <table role="presentation" width="100%" style="max-width:420px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="padding:32px 32px 8px;text-align:center;">
        <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#7c3aed;">Growth Link</p>
      </td></tr>
      <tr><td style="padding:8px 32px 0;text-align:center;">
        <h1 style="margin:0;font-size:20px;color:#18181b;">${heading}</h1>
        <p style="margin:12px 0 24px;font-size:14px;color:#71717a;line-height:1.5;">${bodyLine}</p>
      </td></tr>
      <tr><td style="padding:0 32px 8px;text-align:center;">
        <div style="display:inline-block;padding:16px 28px;background:#f4f4f5;border-radius:10px;font-size:32px;font-weight:700;letter-spacing:0.35em;color:#18181b;">${code}</div>
      </td></tr>
      <tr><td style="padding:16px 32px 32px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#a1a1aa;">Este código vence en 10 minutos. Si no lo pediste vos, ignorá este correo.</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

const SUBJECT_BY_PURPOSE = {
  signup: "Tu código de verificación de Growth Link",
  password_reset: "Tu código para restablecer tu contraseña",
} as const;

const HEADING_BY_PURPOSE = {
  signup: "Confirmá tu cuenta",
  password_reset: "Restablecé tu contraseña",
} as const;

const BODY_BY_PURPOSE = {
  signup: "Ingresá este código en Growth Link para activar tu cuenta.",
  password_reset: "Ingresá este código en Growth Link para elegir una nueva contraseña.",
} as const;

/** Only sender used by the whole custom OTP system (signup confirmation and
 * password recovery) — reads RESEND_API_KEY/FROM_EMAIL from the
 * environment, per the domain (growthlink.uk) now being verified in Resend.
 * Never throws on a bad send silently: callers decide how to surface it. */
export async function sendOtpEmail(params: {
  to: string;
  code: string;
  purpose: "signup" | "password_reset";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const fromEmail = process.env.FROM_EMAIL;
  if (!fromEmail) return { ok: false, error: "FROM_EMAIL no está configurada." };

  const { error } = await getResendClient().emails.send({
    from: fromEmail,
    to: params.to,
    subject: SUBJECT_BY_PURPOSE[params.purpose],
    html: codeEmailHtml(params.code, HEADING_BY_PURPOSE[params.purpose], BODY_BY_PURPOSE[params.purpose]),
    text: `${HEADING_BY_PURPOSE[params.purpose]}\n\nTu código: ${params.code}\n\nVence en 10 minutos. Si no lo pediste vos, ignorá este correo.`,
  });
  if (error) console.error("[resend] send failed:", error.message);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
