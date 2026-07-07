/** Maps Supabase Auth error messages to user-facing Spanish copy. Supabase
 * doesn't expose stable error codes for every case, so this matches on the
 * known English message substrings it returns. */
export function mapAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Correo o contraseña incorrectos.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Todavía no confirmaste tu correo. Revisa tu bandeja de entrada.";
  }
  if (normalized.includes("user already registered") || normalized.includes("already registered")) {
    return "Ya existe una cuenta con ese correo. Intenta iniciar sesión.";
  }
  if (normalized.includes("password should be at least")) {
    return "La contraseña debe tener al menos 8 caracteres.";
  }
  if (normalized.includes("rate limit")) {
    return "Demasiados intentos. Espera un momento y vuelve a intentar.";
  }
  if (normalized.includes("token") && normalized.includes("expired")) {
    return "El enlace expiró. Solicita uno nuevo.";
  }

  return "Ocurrió un error. Intenta nuevamente en unos segundos.";
}
