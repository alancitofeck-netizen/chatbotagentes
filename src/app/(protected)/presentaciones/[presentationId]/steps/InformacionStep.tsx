"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { PersonalInfo } from "@/lib/presentations/constants";
import { FONT_OPTIONS } from "@/lib/presentations/constants";

function Field<K extends keyof PersonalInfo>({
  data,
  onChange,
  field,
  label,
  type = "text",
}: {
  data: PersonalInfo;
  onChange: (data: PersonalInfo) => void;
  field: K;
  label: string;
  type?: string;
}) {
  return (
    <Input
      label={label}
      type={type}
      value={(data[field] as string | number | undefined) ?? ""}
      onChange={(e) => onChange({ ...data, [field]: type === "number" ? Number(e.target.value) : e.target.value })}
    />
  );
}

export function InformacionStep({
  presentationId,
  data,
  onChange,
}: {
  presentationId: string;
  data: PersonalInfo;
  onChange: (data: PersonalInfo) => void;
}) {
  const [uploadingLogo, setUploadingLogo] = useState(false);

  async function handleLogoUpload(file: File) {
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("presentationId", presentationId);
      const res = await fetch("/api/presentations/photo-upload", { method: "POST", body: formData });
      const result = await res.json();
      if (res.ok) onChange({ ...data, logoPath: result.path });
    } finally {
      setUploadingLogo(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Información</h2>
        <p className="text-sm text-neutral-500">Tus datos personales y profesionales — la base de tu presentación.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field data={data} onChange={onChange} field="firstName" label="Nombre" />
        <Field data={data} onChange={onChange} field="lastName" label="Apellido" />
        <Field data={data} onChange={onChange} field="profession" label="Profesión" />
        <Field data={data} onChange={onChange} field="company" label="Empresa" />
        <Field data={data} onChange={onChange} field="specialty" label="Especialidad" />
        <Field data={data} onChange={onChange} field="yearsExperience" label="Años de experiencia" type="number" />
        <Field data={data} onChange={onChange} field="country" label="País" />
        <Field data={data} onChange={onChange} field="city" label="Ciudad" />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Biografía</label>
        <textarea
          value={data.bio ?? ""}
          onChange={(e) => onChange({ ...data, bio: e.target.value })}
          rows={4}
          placeholder="Contá tu trayectoria — la IA la va a usar como base en el paso siguiente."
          className="rounded-sm border border-border-strong bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500 focus:ring-[3px] focus:ring-accent-100"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field data={data} onChange={onChange} field="socialMedia" label="Redes sociales" />
        <Field data={data} onChange={onChange} field="whatsapp" label="WhatsApp" />
        <Field data={data} onChange={onChange} field="email" label="Correo" />
        <Field data={data} onChange={onChange} field="website" label="Página web" />
      </div>

      <div className="rounded-lg border border-border-default bg-surface-2 p-4">
        <p className="mb-3 text-sm font-medium text-foreground">Marca</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Logo</label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-border-default bg-surface-1 p-4 text-sm text-neutral-500 hover:border-accent-300">
              <Upload className="size-4" aria-hidden="true" />
              {uploadingLogo ? "Subiendo…" : data.logoPath ? "Logo cargado — cambiar" : "Subir logo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void handleLogoUpload(file);
                }}
              />
            </label>
          </div>
          <Select label="Tipografía" value={data.fontFamily ?? FONT_OPTIONS[0]} onChange={(e) => onChange({ ...data, fontFamily: e.target.value })}>
            {FONT_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Color principal</label>
            <input
              type="color"
              value={data.primaryColor ?? "#6366F1"}
              onChange={(e) => onChange({ ...data, primaryColor: e.target.value })}
              className="h-9 w-full rounded-md border border-border-default"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-foreground">Color secundario</label>
            <input
              type="color"
              value={data.secondaryColor ?? "#0EA5E9"}
              onChange={(e) => onChange({ ...data, secondaryColor: e.target.value })}
              className="h-9 w-full rounded-md border border-border-default"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
