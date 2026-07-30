"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Badge } from "@/components/ui/Badge";
import type { ClassroomCategory } from "@/lib/classroom/categories/queries";
import type { ClassroomCourse } from "@/lib/classroom/courses/queries";
import type { ClassroomChapter } from "@/lib/classroom/curriculum/queries";
import { ContentTab } from "./ContentTab";
import { ConfiguracionTab } from "./ConfiguracionTab";

/** Course editor shell — Tabs("Contenido"/"Configuración"), same controlled
 * Tabs primitive as every other tabbed detail view in this app (CRM's
 * CardDetailSheet, Mini Apps' detail tabs). */
export function CourseEditorShell({
  course,
  categories,
  initialChapters,
}: {
  course: ClassroomCourse;
  categories: ClassroomCategory[];
  initialChapters: ClassroomChapter[];
}) {
  const [tab, setTab] = useState("contenido");

  return (
    <div className="flex flex-col gap-5 p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <Link
          href="/classroom/admin"
          className="flex size-8 items-center justify-center rounded-md text-neutral-500 hover:bg-surface-2 hover:text-foreground"
          aria-label="Volver"
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-xl font-semibold text-foreground">{course.title}</h1>
        <Badge variant={course.status === "published" ? "success" : "neutral"}>{course.status === "published" ? "Publicado" : "Borrador"}</Badge>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="contenido">Contenido</TabsTrigger>
          <TabsTrigger value="configuracion">Configuración</TabsTrigger>
        </TabsList>
        <div className="pt-5">
          <TabsContent value="contenido">
            <ContentTab courseId={course.id} initialChapters={initialChapters} />
          </TabsContent>
          <TabsContent value="configuracion">
            <ConfiguracionTab course={course} categories={categories} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
