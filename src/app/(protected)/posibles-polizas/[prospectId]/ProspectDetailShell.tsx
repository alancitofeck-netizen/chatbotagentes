"use client";

import { useState, useTransition } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/toast/toast";
import { fileTypeMetaFor, formatFileSize } from "@/components/documents/documentIcons";
import { uploadDocumentFile } from "@/lib/documents/uploadClient";
import { getDocumentsByRelatedAction, recordUploadedDocument, trashDocument, getDownloadUrl } from "@/lib/documents/actions";
import type { DocumentItem } from "@/lib/documents/queries";
import type { WorkspaceMemberOption } from "@/lib/inbox/queries";
import type { ProspectDetail, ProspectNote } from "@/lib/insuranceProspects/queries";
import { PROSPECT_STATUS_OPTIONS, type ProspectStatus } from "@/lib/insuranceProspects/statusOptions";
import {
  updateProspectStatusAction,
  assignProspectOwnerAction,
  updateProspectFieldsAction,
  addProspectNoteAction,
  getProspectNotesAction,
  type ProspectFieldUpdates,
} from "@/lib/insuranceProspects/actions";

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("es", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function ProspectDetailShell({
  prospect,
  initialNotes,
  initialDocuments,
  members,
  canManage,
}: {
  prospect: ProspectDetail;
  initialNotes: ProspectNote[];
  initialDocuments: DocumentItem[];
  members: WorkspaceMemberOption[];
  canManage: boolean;
}) {
  const [tab, setTab] = useState("personal");
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<ProspectStatus>(prospect.status);
  const [ownerAgentId, setOwnerAgentId] = useState(prospect.ownerAgentId ?? "");

  // Información Personal
  const [dateOfBirth, setDateOfBirth] = useState(prospect.dateOfBirth ?? "");
  const [placeOfBirth, setPlaceOfBirth] = useState(prospect.placeOfBirth ?? "");
  const [sex, setSex] = useState(prospect.sex ?? "");
  const [maritalStatus, setMaritalStatus] = useState(prospect.maritalStatus ?? "");
  const [phone, setPhone] = useState(prospect.phone ?? "");
  const [email, setEmail] = useState(prospect.email ?? "");
  const [city, setCity] = useState(prospect.city ?? "");
  const [province, setProvince] = useState(prospect.province ?? "");
  const [country, setCountry] = useState(prospect.country ?? "");

  // Salud y Perfil (+ Formación, sin pestaña propia)
  const [heightCm, setHeightCm] = useState(prospect.heightCm?.toString() ?? "");
  const [weightKg, setWeightKg] = useState(prospect.weightKg?.toString() ?? "");
  const [smoker, setSmoker] = useState(prospect.smoker);
  const [drinksAlcohol, setDrinksAlcohol] = useState(prospect.drinksAlcohol);
  const [exercises, setExercises] = useState(prospect.exercises);
  const [education, setEducation] = useState(prospect.education ?? "");
  const [degree, setDegree] = useState(prospect.degree ?? "");
  const [specializations, setSpecializations] = useState(prospect.specializations ?? "");
  const [hobbies, setHobbies] = useState(prospect.hobbies ?? "");
  const [sports, setSports] = useState(prospect.sports ?? "");
  const [interests, setInterests] = useState(prospect.interests ?? "");

  // Laboral
  const [profession, setProfession] = useState(prospect.profession ?? "");
  const [occupation, setOccupation] = useState(prospect.occupation ?? "");
  const [employer, setEmployer] = useState(prospect.employer ?? "");
  const [employmentTenureMonths, setEmploymentTenureMonths] = useState(prospect.employmentTenureMonths?.toString() ?? "");
  const [monthlyIncome, setMonthlyIncome] = useState(prospect.monthlyIncome?.toString() ?? "");

  // Actividad
  const [notes, setNotes] = useState(initialNotes);
  const [newNote, setNewNote] = useState("");

  // Documentación
  const [documents, setDocuments] = useState(initialDocuments);
  const [uploading, setUploading] = useState(false);

  function saveFields(updates: ProspectFieldUpdates) {
    startTransition(async () => {
      try {
        await updateProspectFieldsAction(prospect.id, updates);
        toast.success("Guardado.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
      }
    });
  }

  function handleStatusChange(next: ProspectStatus) {
    setStatus(next);
    startTransition(async () => {
      await updateProspectStatusAction(prospect.id, next);
      const fresh = await getProspectNotesAction(prospect.id);
      setNotes(fresh);
      toast.success("Estado actualizado.");
    });
  }

  function handleOwnerChange(next: string) {
    setOwnerAgentId(next);
    startTransition(async () => {
      await assignProspectOwnerAction(prospect.id, next || null);
      toast.success("Asesor asignado.");
    });
  }

  function handleAddNote() {
    if (!newNote.trim()) return;
    startTransition(async () => {
      await addProspectNoteAction(prospect.id, newNote);
      setNewNote("");
      const fresh = await getProspectNotesAction(prospect.id);
      setNotes(fresh);
    });
  }

  async function handleUploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      const documentId = crypto.randomUUID();
      const storagePath = `${prospect.workspaceId}/${documentId}/${file.name}`;
      const uploaded = await uploadDocumentFile(storagePath, file);
      if (!uploaded) {
        toast.error(`No se pudo subir ${file.name}.`);
        continue;
      }
      try {
        await recordUploadedDocument({
          name: file.name,
          folderId: null,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          storagePath,
          relatedType: "insurance_prospect",
          relatedId: prospect.id,
        });
      } catch {
        toast.error(`No se pudo registrar ${file.name}.`);
      }
    }
    const fresh = await getDocumentsByRelatedAction("insurance_prospect", prospect.id);
    setDocuments(fresh);
    setUploading(false);
    toast.success("Archivo(s) subido(s).");
  }

  async function handleDownload(documentId: string) {
    const url = await getDownloadUrl(documentId);
    if (url) window.open(url, "_blank");
  }

  function handleDeleteDocument(documentId: string) {
    if (!window.confirm("¿Eliminar este archivo?")) return;
    startTransition(async () => {
      await trashDocument(documentId);
      const fresh = await getDocumentsByRelatedAction("insurance_prospect", prospect.id);
      setDocuments(fresh);
    });
  }

  return (
    <div className="flex flex-col gap-4 px-4 sm:px-6 lg:px-8">
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Select label="Estado" value={status} onChange={(e) => handleStatusChange(e.target.value as ProspectStatus)} disabled={!canManage && isPending}>
          {PROSPECT_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
        <Select label="Asesor propietario" value={ownerAgentId} onChange={(e) => handleOwnerChange(e.target.value)}>
          <option value="">Sin asignar</option>
          {members.map((m) => (
            <option key={m.memberId} value={m.memberId}>
              {m.fullName}
            </option>
          ))}
        </Select>
      </Card>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="personal">Información Personal</TabsTrigger>
          <TabsTrigger value="salud">Salud y Perfil</TabsTrigger>
          <TabsTrigger value="laboral">Laboral</TabsTrigger>
          <TabsTrigger value="actividad">Actividad</TabsTrigger>
          <TabsTrigger value="documentacion">Documentación</TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <Card className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Fecha de nacimiento" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
              <Input label="Lugar de nacimiento" value={placeOfBirth} onChange={(e) => setPlaceOfBirth(e.target.value)} />
              <Input label="Sexo" value={sex} onChange={(e) => setSex(e.target.value)} />
              <Input label="Estado civil" value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value)} />
              <Input label="Teléfono" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input label="Ciudad" value={city} onChange={(e) => setCity(e.target.value)} />
              <Input label="Provincia" value={province} onChange={(e) => setProvince(e.target.value)} />
              <Input label="País" value={country} onChange={(e) => setCountry(e.target.value)} />
            </div>
            <Button
              type="button"
              className="self-start"
              loading={isPending}
              onClick={() =>
                saveFields({ dateOfBirth: dateOfBirth || null, placeOfBirth, sex, maritalStatus, phone, email, city, province, country })
              }
            >
              Guardar cambios
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="salud">
          <Card className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Estatura (cm)" type="number" value={heightCm} onChange={(e) => setHeightCm(e.target.value)} />
              <Input label="Peso (kg)" type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} />
              <Select label="¿Fuma?" value={smoker === null ? "" : smoker ? "si" : "no"} onChange={(e) => setSmoker(e.target.value === "" ? null : e.target.value === "si")}>
                <option value="">Sin dato</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </Select>
              <Select
                label="¿Consume alcohol?"
                value={drinksAlcohol === null ? "" : drinksAlcohol ? "si" : "no"}
                onChange={(e) => setDrinksAlcohol(e.target.value === "" ? null : e.target.value === "si")}
              >
                <option value="">Sin dato</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </Select>
              <Select
                label="¿Realiza actividad física?"
                value={exercises === null ? "" : exercises ? "si" : "no"}
                onChange={(e) => setExercises(e.target.value === "" ? null : e.target.value === "si")}
              >
                <option value="">Sin dato</option>
                <option value="si">Sí</option>
                <option value="no">No</option>
              </Select>
            </div>
            <div className="my-1 h-px bg-border-default" />
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Formación</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Estudios realizados" value={education} onChange={(e) => setEducation(e.target.value)} />
              <Input label="Profesión obtenida" value={degree} onChange={(e) => setDegree(e.target.value)} />
              <Input label="Especializaciones" value={specializations} onChange={(e) => setSpecializations(e.target.value)} />
            </div>
            <div className="my-1 h-px bg-border-default" />
            <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">Perfil personal</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Hobbies" value={hobbies} onChange={(e) => setHobbies(e.target.value)} />
              <Input label="Deportes" value={sports} onChange={(e) => setSports(e.target.value)} />
              <Input label="Intereses" value={interests} onChange={(e) => setInterests(e.target.value)} />
            </div>
            <Button
              type="button"
              className="self-start"
              loading={isPending}
              onClick={() =>
                saveFields({
                  heightCm: heightCm ? Number(heightCm) : null,
                  weightKg: weightKg ? Number(weightKg) : null,
                  smoker,
                  drinksAlcohol,
                  exercises,
                  education,
                  degree,
                  specializations,
                  hobbies,
                  sports,
                  interests,
                })
              }
            >
              Guardar cambios
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="laboral">
          <Card className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Profesión" value={profession} onChange={(e) => setProfession(e.target.value)} />
              <Input label="Ocupación actual" value={occupation} onChange={(e) => setOccupation(e.target.value)} />
              <Input label="Empresa" value={employer} onChange={(e) => setEmployer(e.target.value)} />
              <Input
                label="Antigüedad laboral (meses)"
                type="number"
                value={employmentTenureMonths}
                onChange={(e) => setEmploymentTenureMonths(e.target.value)}
              />
              <Input label="Ingreso mensual" type="number" value={monthlyIncome} onChange={(e) => setMonthlyIncome(e.target.value)} />
            </div>
            <Button
              type="button"
              className="self-start"
              loading={isPending}
              onClick={() =>
                saveFields({
                  profession,
                  occupation,
                  employer,
                  employmentTenureMonths: employmentTenureMonths ? Number(employmentTenureMonths) : null,
                  monthlyIncome: monthlyIncome ? Number(monthlyIncome) : null,
                })
              }
            >
              Guardar cambios
            </Button>
          </Card>
        </TabsContent>

        <TabsContent value="actividad">
          <Card className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Agregar una nota..."
                rows={2}
                className="rounded-md border border-border-default bg-surface-1 px-3 py-2 text-sm text-foreground outline-none focus:border-accent-500"
              />
              <Button type="button" size="sm" className="self-start" onClick={handleAddNote} loading={isPending}>
                Agregar nota
              </Button>
            </div>
            <div className="my-1 h-px bg-border-default" />
            {notes.length === 0 ? (
              <p className="text-sm text-neutral-500">Sin actividad todavía.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-md bg-surface-2 p-3">
                    <p className="text-sm text-foreground">{n.body}</p>
                    <p className="mt-1 text-xs text-neutral-500">{formatDateTime(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="documentacion">
          <Card className="flex flex-col gap-3">
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border-strong px-3 py-3 text-sm text-neutral-500 hover:border-accent-500 hover:text-accent-600">
              <Upload size={15} aria-hidden="true" />
              {uploading ? "Subiendo…" : "Subir documento (DNI, comprobante, declaraciones, PDF, foto)"}
              <input type="file" multiple className="hidden" disabled={uploading} onChange={(e) => handleUploadFiles(e.target.files)} />
            </label>
            {documents.length === 0 ? (
              <p className="text-sm text-neutral-500">Sin archivos todavía.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {documents.map((doc) => {
                  const meta = fileTypeMetaFor(doc.name);
                  const Icon = meta.icon;
                  return (
                    <li key={doc.id} className="flex items-center gap-2 rounded-md bg-surface-2 p-3">
                      <Icon size={16} className={meta.color} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-foreground">{doc.name}</p>
                        <p className="text-xs text-neutral-500">{formatFileSize(doc.sizeBytes)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDownload(doc.id)}
                        className="flex size-7 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-3 hover:text-foreground"
                        aria-label="Descargar"
                      >
                        <Download size={14} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(doc.id)}
                        className="flex size-7 items-center justify-center rounded-md text-neutral-400 hover:bg-error-bg hover:text-error-strong"
                        aria-label="Eliminar"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
