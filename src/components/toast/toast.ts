import { toast as sonnerToast } from "sonner";

export const toast = {
  success: (message: string, description?: string) =>
    sonnerToast.success(message, { description }),
  error: (message: string, description?: string) =>
    sonnerToast.error(message, { description }),
  info: (message: string, description?: string) =>
    sonnerToast(message, { description }),
  /** Aviso de lead nuevo (banner en vivo del prototipo): con botón "Ver" si hay destino. */
  lead: (message: string, description?: string, href?: string | null) =>
    sonnerToast(message, {
      description,
      duration: 6500,
      action: href ? { label: "Ver", onClick: () => window.location.assign(href) } : undefined,
    }),
};
