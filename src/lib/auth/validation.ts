const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | undefined {
  if (!email.trim()) return "Ingresa tu correo electrónico.";
  if (!EMAIL_RE.test(email.trim())) return "Ingresa un correo electrónico válido.";
  return undefined;
}

export function validatePassword(password: string): string | undefined {
  if (!password) return "Ingresa tu contraseña.";
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  return undefined;
}

export function validateName(name: string): string | undefined {
  if (!name.trim()) return "Ingresa tu nombre.";
  if (name.trim().length < 2) return "Ingresa un nombre válido.";
  return undefined;
}

export function validatePasswordConfirmation(
  password: string,
  confirmation: string,
): string | undefined {
  if (!confirmation) return "Confirma tu contraseña.";
  if (password !== confirmation) return "Las contraseñas no coinciden.";
  return undefined;
}
