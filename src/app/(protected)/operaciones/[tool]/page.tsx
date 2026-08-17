import { notFound } from "next/navigation";
import { FileCode2 } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";

const KNOWN_TOOLS = new Set(["herramienta-1", "herramienta-2"]);

/** Placeholder hasta que se cargue el HTML real de cada herramienta — en
 * ese momento esta página pasa a servir el archivo en un <iframe>
 * mismo-origen (mismo motivo que Asesorías/Meeting OS: aislar el `window`
 * del archivo evita que sus globals choquen con el runtime de Next.js). */
export default async function OperacionToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  if (!KNOWN_TOOLS.has(tool)) notFound();

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <EmptyState icon={FileCode2} title="Todavía no se cargó esta herramienta" description="En cuanto se suba el contenido, va a aparecer acá." />
    </div>
  );
}
