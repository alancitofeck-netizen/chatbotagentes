"use client";

import { useState } from "react";
import { Copy, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";

/** Mensaje sugerido de la ficha de lead del prototipo: se precarga con el nombre
 * del lead y la mini app que completó, y se puede editar antes de enviar. */
function suggestedMessage(nombre: string, appName: string | null) {
  // Quita prefijos entre corchetes (p. ej. "[QA]") antes de tomar el primer nombre.
  const clean = nombre.replace(/^\[[^\]]*\]\s*/, "").trim();
  const first = clean.split(" ")[0] || "hola";
  if (appName) {
    return `Hola ${first}, vi que completaste ${appName}. ¿Te parece si lo revisamos juntos esta semana?`;
  }
  return `Hola ${first}, te escribo por la consulta que dejaste en Growth Link. ¿Seguís buscando ayuda con esto?`;
}

/** WhatsApp abre el chat con el texto ya armado (wa.me), igual que los demás
 * envíos manuales de la app. Sin teléfono válido no hay enlace. */
function whatsappUrl(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function LeadMessageBox({ nombre, whatsapp, appName }: { nombre: string; whatsapp: string; appName: string | null }) {
  const [text, setText] = useState(() => suggestedMessage(nombre, appName));
  const [copied, setCopied] = useState(false);
  const url = whatsappUrl(whatsapp, text);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Sin permiso de portapapeles el texto sigue editable en el cuadro.
    }
  }

  return (
    <section aria-label="Mensaje sugerido" className="flex flex-col gap-3 rounded-lg border border-border-default bg-surface-2 p-4">
      <p className="flex items-center gap-1.5 text-[13px] font-medium text-neutral-600">
        <Sparkles className="size-3.5 text-accent-600" aria-hidden="true" />
        Mensaje sugerido
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        aria-label="Texto del mensaje"
        className="w-full resize-y rounded-md border border-border-default bg-surface-1 p-3 text-sm leading-relaxed text-foreground outline-none focus:border-accent-500"
      />
      <div className="grid grid-cols-2 gap-2">
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent-600 text-sm font-medium text-[var(--on-accent)] hover:bg-accent-700"
          >
            <Send className="size-4" aria-hidden="true" />
            Enviar por WhatsApp
          </a>
        ) : (
          <Button disabled>Sin WhatsApp válido</Button>
        )}
        <Button variant="secondary" onClick={copy}>
          <Copy className="size-4" aria-hidden="true" />
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>
    </section>
  );
}
