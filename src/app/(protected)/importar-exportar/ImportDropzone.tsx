"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { UploadCloud } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { ImportWizard } from "./ImportWizard";

const SUPPORTED_TYPES = [
  { label: "Clientes" },
  { label: "Prospectos" },
  { label: "Pólizas" },
  { label: "Cobros" },
  { label: "Eventos" },
  { label: "Tareas" },
];

export function ImportDropzone({ onImported }: { onImported: () => void }) {
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(selected: File | undefined) {
    if (!selected) return;
    setFile(selected);
  }

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold text-foreground">📥 Importar información</p>
        <p className="text-[13px] text-neutral-500">Sube tu Excel/CSV y mapea las columnas</p>
      </div>

      <motion.label
        data-tour="data-transfer.dropzone"
        whileHover={{ scale: 1.005 }}
        transition={{ duration: 0.15 }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed bg-surface-2 p-10 text-center transition-colors duration-150",
          isDragging ? "border-accent-500 bg-accent-100/40" : "border-border-strong",
        )}
      >
        <UploadCloud className={cn("size-9", isDragging ? "text-accent-500" : "text-neutral-400")} aria-hidden="true" />
        <p className="text-sm font-medium text-foreground">Arrastra un archivo aquí</p>
        <p className="text-xs text-neutral-500">
          o <span className="text-accent-600 underline">haz clic para seleccionarlo</span>
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </motion.label>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">Archivos soportados</p>
        <ul className="flex flex-col gap-1">
          {SUPPORTED_TYPES.map((t) => (
            <li key={t.label} className="text-[13px] text-neutral-500">
              • {t.label}
            </li>
          ))}
        </ul>
      </div>

      {file && (
        <ImportWizard
          file={file}
          onClose={() => setFile(null)}
          onImported={() => {
            setFile(null);
            onImported();
          }}
        />
      )}
    </Card>
  );
}
